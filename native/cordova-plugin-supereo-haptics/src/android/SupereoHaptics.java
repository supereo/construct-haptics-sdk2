package com.supereo.haptics;

import android.annotation.SuppressLint;
import android.annotation.TargetApi;
import android.content.Context;
import android.media.AudioAttributes;
import android.os.Build;
import android.os.SystemClock;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.provider.Settings;
import android.view.HapticFeedbackConstants;
import android.view.View;
import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;

/** Public Android haptics only. All requests and lifecycle operations serialize on the UI thread. */
public final class SupereoHaptics extends CordovaPlugin {
    private static final int MAX_EVENTS = 64, MAX_CURVE_POINTS = 32, MAX_DURATION_MS = 10000;
    private static final int TRANSIENT_MS = 12, SAMPLE_MS = 5, REQUEST_TIMEOUT_MS = 5000;
    // This sentinel is waveform metadata, converted to on/off timings below API26.
    private static final int DEFAULT_ON_AMPLITUDE = -1;
    private static final String BACKEND = "android-native";
    private Vibrator vibrator;
    private boolean enabled = true, foreground = true, released = false, active = false;
    private double overallStrength = 1;
    private long busyUntil = 0;
    private volatile int lifecycleGeneration = 0;

    @Override protected void pluginInitialize() {
        Context context = cordova.getActivity().getApplicationContext();
        if (Build.VERSION.SDK_INT >= 31) {
            VibratorManager manager = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            vibrator = manager == null ? null : manager.getDefaultVibrator();
        } else {
            vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
        }
    }

    @Override public boolean execute(String action, JSONArray args, CallbackContext callback) {
        if (!Arrays.asList("getCapabilities", "play", "stop", "setState").contains(action)) return false;
        final int generation = lifecycleGeneration;
        final long receivedAt = SystemClock.elapsedRealtime();
        cordova.getActivity().runOnUiThread(() -> {
            try {
                if (released) throw new InputError("released", "The native haptics bridge has been released.");
                switch (action) {
                    case "getCapabilities": callback.success(capabilities()); break;
                    case "stop": cancelOwned(); callback.success(baseResult("", true, 0)); break;
                    case "setState": callback.success(setState(argument(args))); break;
                    case "play": callback.success(play(argument(args), generation, receivedAt)); break;
                    default: break;
                }
            } catch (InputError error) {
                callback.error(errorJSON(error.code, error.getMessage()));
            } catch (JSONException error) {
                callback.error(errorJSON("invalid-request", "The native request must contain valid bounded JSON: " + error.getMessage()));
            } catch (SecurityException error) {
                callback.error(errorJSON("permission", "Android VIBRATE permission is unavailable."));
            } catch (RuntimeException | LinkageError error) {
                callback.error(errorJSON("native-error", "Android could not dispatch haptics: " + error.getClass().getSimpleName()));
            }
        });
        return true;
    }

    private static JSONObject argument(JSONArray args) throws JSONException, InputError {
        if (args.length() != 1 || !(args.get(0) instanceof JSONObject))
            throw new InputError("invalid-request", "Expected exactly one request object.");
        return args.getJSONObject(0);
    }

    private JSONObject setState(JSONObject request) throws JSONException, InputError {
        keys(request, "enabled", "strength");
        boolean nextEnabled = enabled;
        double nextStrength = overallStrength;
        if (request.has("enabled")) {
            if (!(request.get("enabled") instanceof Boolean)) throw new InputError("invalid-request", "enabled must be true or false.");
            nextEnabled = request.getBoolean("enabled");
        }
        if (request.has("strength")) nextStrength = number(request, "strength", 0, 1);
        if (!nextEnabled || nextStrength != overallStrength) cancelOwned();
        enabled = nextEnabled;
        overallStrength = nextStrength;
        return baseResult("", true, 0).put("enabled", enabled).put("strength", overallStrength);
    }

    private JSONObject play(JSONObject request, int generation, long receivedAt) throws JSONException, InputError {
        keys(request, "requestId", "kind", "style", "notification", "pattern", "strength", "overlap");
        String requestId = string(request, "requestId", "", 128);
        String kind = string(request, "kind", "", 32);
        String style = string(request, "style", "medium", 32);
        String notification = string(request, "notification", "success", 32);
        String overlap = string(request, "overlap", "replace", 16);
        if (!Arrays.asList("selection", "impact", "notification", "pattern").contains(kind))
            throw new InputError("invalid-request", "kind must be selection, impact, notification or pattern.");
        if (!Arrays.asList("light", "medium", "heavy", "soft", "rigid").contains(style))
            throw new InputError("invalid-request", "Unknown impact style.");
        if (!Arrays.asList("success", "warning", "error").contains(notification))
            throw new InputError("invalid-request", "Unknown notification type.");
        if (!Arrays.asList("replace", "ignore").contains(overlap))
            throw new InputError("invalid-request", "overlap must be replace or ignore.");
        double strength = overallStrength * (request.has("strength") ? number(request, "strength", 0, 1) : 1);
        Pattern pattern = kind.equals("pattern") ? validatePattern(request.getJSONObject("pattern")) : preset(kind, style, notification);
        if (!foreground || generation != lifecycleGeneration) return refused(requestId, "background");
        if (!enabled || strength == 0) return refused(requestId, "disabled");
        if (!hardware()) return refused(requestId, "no-hardware");
        if (!systemHapticsEnabled()) return refused(requestId, "system-disabled");
        long now = SystemClock.elapsedRealtime();
        if (now - receivedAt >= REQUEST_TIMEOUT_MS) return refused(requestId, "request-expired");
        if (overlap.equals("ignore") && active && now < busyUntil) return refused(requestId, "busy");
        if (!pattern.hasEnergy()) return refused(requestId, "silent-pattern");
        if (overlap.equals("replace")) cancelOwned();
        JSONArray fallback = new JSONArray();
        int semanticConstant = semanticFeedback(kind, notification, strength);
        boolean semantic = semanticConstant != -1;
        long duration = pattern.duration;
        if (semantic) {
            View view = webView.getView();
            if (!view.performHapticFeedback(semanticConstant)) return refused(requestId, "system-feedback-declined");
            // System semantic effects do not expose their duration or a completion callback.
            duration = kind.equals("selection") ? 40 : 200;
        } else {
            VibrationEffect effect = null;
            if (Build.VERSION.SDK_INT >= 36 && envelopeSupport()) {
                effect = Api36.envelope(vibrator, pattern, strength, fallback);
            }
            if (effect == null && Build.VERSION.SDK_INT >= 30) {
                Composed composed = primitiveComposition(pattern, strength);
                if (composed != null) {
                    effect = composed.effect;
                    duration = composed.duration;
                    addFallback(fallback, "portable-transients-mapped-to-native-primitives");
                }
            }
            if (effect == null && kind.equals("impact") && strength == 1 && Build.VERSION.SDK_INT >= 29) {
                int effectId = style.equals("heavy") ? VibrationEffect.EFFECT_HEAVY_CLICK :
                        style.equals("light") || style.equals("soft") ? VibrationEffect.EFFECT_TICK : VibrationEffect.EFFECT_CLICK;
                int support = effectSupport(effectId);
                if (support != Vibrator.VIBRATION_EFFECT_SUPPORT_NO) {
                    effect = VibrationEffect.createPredefined(effectId);
                    if (support == Vibrator.VIBRATION_EFFECT_SUPPORT_UNKNOWN) addFallback(fallback, "predefined-support-unknown-system-may-approximate");
                    if (style.equals("soft") || style.equals("rigid")) addFallback(fallback, "impact-style-mapped-to-predefined-effect");
                    duration = 70;
                }
            }
            if (effect == null) {
                addFallback(fallback, "portable-events-sampled-to-5ms-waveform");
                if (pattern.hasSharpness) addFallback(fallback, "sharpness-not-reproduced-by-waveform");
                if (!amplitude()) addFallback(fallback, "motor-has-no-amplitude-control-nonzero-intensity-becomes-on-off");
                Waveform wave = waveform(pattern, strength, amplitude());
                if (!wave.hasEnergy) return refused(requestId, "below-waveform-resolution");
                if (Build.VERSION.SDK_INT >= 26) effect = VibrationEffect.createWaveform(wave.times, wave.amplitudes, -1);
                else {
                    vibrator.vibrate(wave.legacy, -1, audioAttributes());
                    dispatched(now, duration);
                    return result(requestId, duration, fallback, "waveform");
                }
            }
            vibrate(effect);
        }
        dispatched(now, duration);
        return result(requestId, duration, fallback, semantic ? "system-feedback" : "vibration-effect");
    }

    private static int semanticFeedback(String kind, String notification, double strength) {
        if (strength != 1) return -1;
        if (kind.equals("selection")) return Build.VERSION.SDK_INT >= 34
                ? HapticFeedbackConstants.SEGMENT_TICK : HapticFeedbackConstants.CLOCK_TICK;
        if (kind.equals("notification") && !notification.equals("warning") && Build.VERSION.SDK_INT >= 30)
            return notification.equals("success") ? HapticFeedbackConstants.CONFIRM : HapticFeedbackConstants.REJECT;
        return -1;
    }
    private void dispatched(long now, long duration) {
        active = true;
        busyUntil = now + duration;
    }

    private JSONObject result(String requestId, long duration, JSONArray fallback, String route) throws JSONException {
        return baseResult(requestId, true, duration).put("approximated", fallback.length() > 0)
                .put("fallback", fallback).put("route", route).put("durationKind", "scheduling-estimate");
    }
    private static JSONObject baseResult(String requestId, boolean accepted, long duration) throws JSONException {
        return new JSONObject().put("accepted", accepted).put("requestId", requestId).put("backend", BACKEND)
                .put("approximated", false).put("fallback", new JSONArray()).put("durationMs", duration)
                .put("completion", "not-observable");
    }
    private static JSONObject refused(String requestId, String reason) throws JSONException {
        return baseResult(requestId, false, 0).put("reason", reason);
    }
    private static JSONObject errorJSON(String code, String message) {
        JSONObject object = new JSONObject();
        try { object.put("code", code).put("message", message).put("backend", BACKEND); } catch (JSONException ignored) { }
        return object;
    }

    private boolean hardware() { return vibrator != null && vibrator.hasVibrator(); }
    private boolean amplitude() { return hardware() && Build.VERSION.SDK_INT >= 26 && vibrator.hasAmplitudeControl(); }
    private boolean envelopeSupport() { return hardware() && Build.VERSION.SDK_INT >= 36 && Api36.supported(vibrator); }
    @SuppressLint("InlinedApi") // UNKNOWN is the public inline sentinel 0, safely returned before API30.
    private int effectSupport(int effect) {
        return hardware() && Build.VERSION.SDK_INT >= 30 ? vibrator.areEffectsSupported(effect)[0] : Vibrator.VIBRATION_EFFECT_SUPPORT_UNKNOWN;
    }
    private boolean systemHapticsEnabled() {
        // Never pass FLAG_IGNORE_GLOBAL_SETTING or FLAG_IGNORE_VIEW_SETTING. TOUCH usage lets the
        // framework apply current user intensity, accessibility, power and interruption policy.
        return Settings.System.getInt(cordova.getActivity().getContentResolver(), Settings.System.HAPTIC_FEEDBACK_ENABLED, 1) != 0
                && webView.getView().isHapticFeedbackEnabled();
    }
    private static AudioAttributes audioAttributes() {
        return new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
    }
    @TargetApi(26) // Called only after API26+ creates a VibrationEffect; older path returns above.
    private void vibrate(VibrationEffect effect) {
        if (Build.VERSION.SDK_INT >= 33) {
            vibrator.vibrate(effect, new VibrationAttributes.Builder().setUsage(VibrationAttributes.USAGE_TOUCH).build());
        } else vibrator.vibrate(effect, audioAttributes());
    }
    private void cancelOwned() {
        if (active && vibrator != null && SystemClock.elapsedRealtime() < busyUntil) vibrator.cancel();
        active = false;
        busyUntil = 0;
        // Public cancel is app-scoped; avoid calling it when this addon has nothing outstanding.
    }
    @Override public void onPause(boolean multitasking) {
        lifecycleGeneration++;
        foreground = false;
        cancelOwned();
    }
    @Override public void onResume(boolean multitasking) { foreground = true; }
    @Override public void onReset() {
        lifecycleGeneration++;
        cancelOwned();
        enabled = true;
        overallStrength = 1;
    }
    @Override public void onDestroy() {
        lifecycleGeneration++;
        released = true;
        foreground = false;
        cancelOwned();
    }

    private JSONObject capabilities() throws JSONException {
        boolean envelopes = envelopeSupport(), amp = amplitude(), primitive = false;
        JSONObject effects = new JSONObject(), primitives = new JSONObject(), durations = new JSONObject();
        int[] effectIds = {0, 1, 2, 5};
        String[] effectNames = {"click", "doubleClick", "tick", "heavyClick"};
        for (int i = 0; i < effectIds.length; i++) {
            int support = effectSupport(effectIds[i]);
            effects.put(effectNames[i], support == Vibrator.VIBRATION_EFFECT_SUPPORT_YES ? "yes" :
                    support == Vibrator.VIBRATION_EFFECT_SUPPORT_NO ? "no" : "unknown");
        }
        int[] ids = {1, 2, 3, 4, 5, 6, 7, 8};
        String[] names = {"click", "thud", "spin", "quickRise", "slowRise", "quickFall", "tick", "lowTick"};
        boolean[] supported = hardware() && Build.VERSION.SDK_INT >= 30 ? queryPrimitiveSupport(ids) : new boolean[ids.length];
        int[] lengths = hardware() && Build.VERSION.SDK_INT >= 31 ? queryPrimitiveDurations(ids) : new int[ids.length];
        for (int i = 0; i < ids.length; i++) {
            primitives.put(names[i], supported[i]);
            durations.put(names[i], lengths[i]);
            primitive |= supported[i];
        }
        JSONArray info = new JSONArray();
        info.put("Dispatch acceptance does not prove the motor produced feedback.");
        if (!amp) info.put("Waveforms cannot reproduce normalized intensity on this motor.");
        if (!envelopes) info.put("Portable sharpness is approximated by supported primitive choice or ignored in waveforms.");
        JSONObject caps = new JSONObject().put("backend", BACKEND).put("bridgeAvailable", true)
                .put("hardwareAvailable", hardware()).put("intensityControl", amp || primitive || envelopes)
                .put("advancedPatterns", amp || primitive || envelopes).put("amplitudeControl", amp)
                .put("sharpnessControl", envelopes).put("intensityCurves", amp || envelopes)
                .put("sharpnessCurves", envelopes).put("primitives", primitive).put("envelopes", envelopes)
                .put("effectSupport", effects).put("primitiveSupport", primitives).put("primitiveDurationsMs", durations)
                .put("sdkInt", Build.VERSION.SDK_INT).put("systemHapticsEnabled", systemHapticsEnabled())
                .put("fallbackInfo", info.join(" ")).put("completion", "not-observable");
        if (envelopes) caps.put("envelopeLimits", Api36.limits(vibrator));
        return caps;
    }

    @TargetApi(30)
    @SuppressLint("WrongConstant") // Caller supplies only the public primitive IDs 1..8 above.
    private boolean[] queryPrimitiveSupport(int[] ids) { return vibrator.arePrimitivesSupported(ids); }
    @TargetApi(31)
    @SuppressLint("WrongConstant") // Same documented IDs, queried only after the API31 guard.
    private int[] queryPrimitiveDurations(int[] ids) { return vibrator.getPrimitiveDurations(ids); }

    private static void keys(JSONObject object, String... allowed) throws InputError {
        Set<String> names = new HashSet<>(Arrays.asList(allowed));
        Iterator<String> iterator = object.keys();
        while (iterator.hasNext()) {
            String key = iterator.next();
            if (!names.contains(key)) throw new InputError("invalid-request", "Unknown field: " + key);
        }
    }
    private static double number(JSONObject object, String key, double min, double max) throws JSONException, InputError {
        Object raw = object.get(key);
        if (!(raw instanceof Number)) throw new InputError("invalid-request", key + " must be a number.");
        double value = ((Number) raw).doubleValue();
        if (!Double.isFinite(value) || value < min || value > max)
            throw new InputError("invalid-request", key + " must be between " + min + " and " + max + ".");
        return value;
    }
    private static int millis(JSONObject object, String key, int min, int max) throws JSONException, InputError {
        double value = number(object, key, min, max);
        if (value != Math.floor(value)) throw new InputError("invalid-request", key + " must contain whole milliseconds.");
        return (int) value;
    }
    private static String string(JSONObject object, String key, String fallback, int max) throws JSONException, InputError {
        if (!object.has(key)) return fallback;
        Object raw = object.get(key);
        if (!(raw instanceof String) || ((String) raw).length() > max) throw new InputError("invalid-request", key + " must be a bounded string.");
        return (String) raw;
    }
    private static Pattern validatePattern(JSONObject json) throws JSONException, InputError {
        keys(json, "version", "events");
        if (millis(json, "version", 1, 1) != 1) throw new InputError("invalid-pattern", "Only pattern version 1 is supported.");
        JSONArray list = json.getJSONArray("events");
        if (list.length() < 1 || list.length() > MAX_EVENTS) throw new InputError("invalid-pattern", "Patterns require 1 to 64 events.");
        Pattern pattern = new Pattern();
        for (int i = 0; i < list.length(); i++) {
            JSONObject source = list.getJSONObject(i);
            keys(source, "timeMs", "type", "durationMs", "intensity", "sharpness", "curves");
            Event event = new Event();
            event.time = millis(source, "timeMs", 0, MAX_DURATION_MS);
            String type = string(source, "type", "", 16);
            if (!type.equals("transient") && !type.equals("continuous")) throw new InputError("invalid-pattern", "Event type must be transient or continuous.");
            event.transientTap = type.equals("transient");
            event.duration = event.transientTap ? TRANSIENT_MS : millis(source, "durationMs", 1, MAX_DURATION_MS);
            if (event.transientTap && source.has("durationMs")) throw new InputError("invalid-pattern", "Transient taps do not have durationMs.");
            event.intensity = number(source, "intensity", 0, 1);
            event.sharpness = source.has("sharpness") ? number(source, "sharpness", 0, 1) : 0.5;
            pattern.hasSharpness |= source.has("sharpness");
            if ((long) event.time + event.duration > MAX_DURATION_MS) throw new InputError("invalid-pattern", "Pattern duration exceeds 10000ms including transient fallback tails.");
            if (source.has("curves")) {
                if (event.transientTap) throw new InputError("invalid-pattern", "Parameter curves require a continuous effect.");
                JSONObject curves = source.getJSONObject("curves");
                keys(curves, "intensity", "sharpness");
                if (curves.length() == 0) throw new InputError("invalid-pattern", "curves must define intensity or sharpness.");
                if (curves.has("intensity")) event.intensityCurve = validateCurve(curves.getJSONArray("intensity"), event.duration);
                if (curves.has("sharpness")) {
                    event.sharpnessCurve = validateCurve(curves.getJSONArray("sharpness"), event.duration);
                    pattern.hasSharpness = true;
                }
            }
            pattern.events.add(event);
            pattern.duration = Math.max(pattern.duration, event.time + event.duration);
        }
        Collections.sort(pattern.events, Comparator.comparingInt(event -> event.time));
        return pattern;
    }
    private static List<Point> validateCurve(JSONArray points, int duration) throws JSONException, InputError {
        if (points.length() < 1 || points.length() > MAX_CURVE_POINTS) throw new InputError("invalid-pattern", "Curves require 1 to 32 points.");
        List<Point> curve = new ArrayList<>();
        int previous = -1;
        for (int i = 0; i < points.length(); i++) {
            JSONObject point = points.getJSONObject(i);
            keys(point, "timeMs", "value");
            int time = millis(point, "timeMs", 0, duration);
            if (time <= previous) throw new InputError("invalid-pattern", "Curve points must have strictly increasing times within the event duration.");
            curve.add(new Point(time, number(point, "value", 0, 1)));
            previous = time;
        }
        return curve;
    }
    private static double curveValue(List<Point> points, double base, double time) {
        double previousTime = 0, previousValue = base;
        for (Point point : points) {
            if (time < point.time) {
                return previousValue + (point.value - previousValue) * (time - previousTime) / (point.time - previousTime);
            }
            previousTime = point.time;
            previousValue = point.value;
        }
        return previousValue;
    }
    private static Pattern preset(String kind, String style, String notification) {
        Pattern pattern = new Pattern();
        if (kind.equals("selection")) pattern.events.add(tap(0, .3, .4));
        else if (kind.equals("impact")) {
            double intensity = style.equals("light") ? .35 : style.equals("heavy") ? 1 : style.equals("soft") ? .5 : .65;
            double sharpness = style.equals("soft") ? .15 : style.equals("rigid") ? 1 : .65;
            pattern.events.add(tap(0, intensity, sharpness));
        } else if (notification.equals("warning")) {
            pattern.events.add(tap(0, .7, .75)); pattern.events.add(tap(100, .7, .75));
        } else if (notification.equals("error")) {
            pattern.events.add(tap(0, .95, .8)); pattern.events.add(tap(70, .5, .8)); pattern.events.add(tap(140, .9, .8));
        } else {
            pattern.events.add(tap(0, .3, .6)); pattern.events.add(tap(80, .6, .7)); pattern.events.add(tap(160, 1, .8));
        }
        pattern.hasSharpness = true;
        pattern.duration = pattern.events.get(pattern.events.size() - 1).time + TRANSIENT_MS;
        return pattern;
    }
    private static Event tap(int time, double intensity, double sharpness) {
        Event event = new Event();
        event.time = time; event.duration = TRANSIENT_MS; event.transientTap = true;
        event.intensity = intensity; event.sharpness = sharpness;
        return event;
    }
    @TargetApi(30) // Called only after API30 guard; multiple-tap duration queries are guarded at31.
    private Composed primitiveComposition(Pattern pattern, double strength) {
        VibrationEffect.Composition composition = VibrationEffect.startComposition();
        if (Build.VERSION.SDK_INT < 31) {
            // API30 has scaling/support checks, but no duration query to align multiple taps.
            int tapCount = 0;
            for (Event event : pattern.events) if (event.intensity > 0) tapCount++;
            if (tapCount != 1) return null;
        }
        long previousEnd = 0;
        for (Event event : pattern.events) {
            if (!event.transientTap || !event.intensityCurve.isEmpty() || !event.sharpnessCurve.isEmpty()) return null;
            if (event.intensity == 0) continue;
            int primitive = event.sharpness >= .7 ? VibrationEffect.Composition.PRIMITIVE_CLICK : VibrationEffect.Composition.PRIMITIVE_TICK;
            if (event.sharpness < .35 && Build.VERSION.SDK_INT >= 31) primitive = VibrationEffect.Composition.PRIMITIVE_LOW_TICK;
            if (!vibrator.arePrimitivesSupported(primitive)[0]) return null;
            int length = Build.VERSION.SDK_INT >= 31 ? vibrator.getPrimitiveDurations(primitive)[0] : 70;
            if (length <= 0 || event.time < previousEnd) return null;
            composition.addPrimitive(primitive, (float) (event.intensity * strength), (int) (event.time - previousEnd));
            previousEnd = event.time + length;
            if (previousEnd > MAX_DURATION_MS) return null;
        }
        if (previousEnd == 0) return null;
        return new Composed(composition.compose(), previousEnd);
    }
    private static Waveform waveform(Pattern pattern, double strength, boolean amplitude) {
        List<Long> times = new ArrayList<>();
        List<Integer> values = new ArrayList<>();
        boolean energy = false;
        for (int time = 0; time < pattern.duration; time += SAMPLE_MS) {
            int span = Math.min(SAMPLE_MS, pattern.duration - time);
            double intensity = 0;
            for (Event event : pattern.events) {
                if (time + span / 2.0 >= event.time && time + span / 2.0 < event.time + event.duration) {
                    intensity = Math.max(intensity, curveValue(event.intensityCurve, event.intensity, time + span / 2.0 - event.time));
                }
            }
            intensity *= strength;
            int value = intensity <= 0 ? 0 : amplitude ? (int) Math.round(intensity * 255) : DEFAULT_ON_AMPLITUDE;
            energy |= value != 0;
            if (!values.isEmpty() && values.get(values.size() - 1) == value) times.set(times.size() - 1, times.get(times.size() - 1) + span);
            else { times.add((long) span); values.add(value); }
        }
        long[] timings = new long[times.size()];
        int[] amplitudes = new int[times.size()];
        List<Long> legacy = new ArrayList<>();
        boolean on = false;
        legacy.add(0L);
        for (int i = 0; i < times.size(); i++) {
            timings[i] = times.get(i); amplitudes[i] = values.get(i);
            boolean nextOn = amplitudes[i] != 0;
            if (nextOn != on) { legacy.add(times.get(i)); on = nextOn; }
            else legacy.set(legacy.size() - 1, legacy.get(legacy.size() - 1) + times.get(i));
        }
        long[] legacyArray = new long[legacy.size()];
        for (int i = 0; i < legacy.size(); i++) legacyArray[i] = legacy.get(i);
        return new Waveform(timings, amplitudes, legacyArray, energy);
    }
    private static void addFallback(JSONArray fallback, String reason) {
        for (int i = 0; i < fallback.length(); i++) if (reason.equals(fallback.optString(i))) return;
        fallback.put(reason);
    }

    /** Isolate API36 types so devices on earlier releases never load envelope implementation. */
    @TargetApi(36) // Every entry point is protected by SDK_INT>=36 and hardware support checks.
    private static final class Api36 {
        static boolean supported(Vibrator vibrator) {
            try { return vibrator.areEnvelopeEffectsSupported(); }
            catch (RuntimeException | LinkageError ignored) { return false; }
        }
        static JSONObject limits(Vibrator vibrator) throws JSONException {
            android.os.vibrator.VibratorEnvelopeEffectInfo info = vibrator.getEnvelopeEffectInfo();
            return new JSONObject().put("maxControlPoints", info.getMaxSize())
                    .put("minControlPointDurationMs", info.getMinControlPointDurationMillis())
                    .put("maxControlPointDurationMs", info.getMaxControlPointDurationMillis())
                    .put("maxDurationMs", info.getMaxDurationMillis());
        }
        static VibrationEffect envelope(Vibrator vibrator, Pattern pattern, double strength, JSONArray fallback) {
            // Portable overlapping or transient events use primitives/waveforms. This bounded route
            // preserves continuous intensity/sharpness curves and applies hardware-specific ramps.
            if (pattern.events.size() != 1) return null;
            Event event = pattern.events.get(0);
            if (event.transientTap) return null;
            android.os.vibrator.VibratorEnvelopeEffectInfo info = vibrator.getEnvelopeEffectInfo();
            long min = info.getMinControlPointDurationMillis(), max = info.getMaxControlPointDurationMillis();
            if (min <= 0 || max < min || event.duration < 2 * min) return null;
            if (event.time > 0 && event.time < min) return null;
            if (pattern.duration > info.getMaxDurationMillis()) return null;
            java.util.TreeSet<Integer> knots = new java.util.TreeSet<>();
            knots.add((int) min); knots.add(event.duration - (int) min); knots.add(event.duration);
            for (Point point : event.intensityCurve) if (point.time > 0) knots.add(point.time);
            for (Point point : event.sharpnessCurve) if (point.time > 0) knots.add(point.time);
            int previous = 0, points = event.time > 0 ? 1 : 0;
            for (int knot : knots) {
                int span = knot - previous;
                if (span < min || span > max) return null;
                points++; previous = knot;
            }
            if (points > info.getMaxSize() || (event.time > max)) return null;
            VibrationEffect.BasicEnvelopeBuilder builder = new VibrationEffect.BasicEnvelopeBuilder()
                    .setInitialSharpness((float) curveValue(event.sharpnessCurve, event.sharpness, 0));
            if (event.time > 0) builder.addControlPoint(0, (float) event.sharpness, event.time);
            previous = 0;
            for (int knot : knots) {
                double intensity = knot == event.duration ? 0 : curveValue(event.intensityCurve, event.intensity, knot) * strength;
                double sharpness = curveValue(event.sharpnessCurve, event.sharpness, knot);
                builder.addControlPoint((float) intensity, (float) sharpness, knot - previous);
                previous = knot;
            }
            addFallback(fallback, "android-envelope-adds-hardware-minimum-start-and-end-ramps");
            addFallback(fallback, "android-envelope-sharpness-is-device-frequency-mapping-not-core-haptics-equivalence");
            return builder.build();
        }
    }
    private static final class Event {
        int time, duration;
        boolean transientTap;
        double intensity, sharpness;
        List<Point> intensityCurve = Collections.emptyList(), sharpnessCurve = Collections.emptyList();
    }
    private static final class Pattern {
        List<Event> events = new ArrayList<>();
        int duration;
        boolean hasSharpness;
        boolean hasEnergy() {
            for (Event event : events) {
                if (event.intensity > 0) return true;
                for (Point point : event.intensityCurve) if (point.value > 0) return true;
            }
            return false;
        }
    }
    private static final class Point {
        final int time; final double value;
        Point(int time, double value) { this.time = time; this.value = value; }
    }
    private static final class Composed {
        final VibrationEffect effect; final long duration;
        Composed(VibrationEffect effect, long duration) { this.effect = effect; this.duration = duration; }
    }
    private static final class Waveform {
        final long[] times, legacy; final int[] amplitudes; final boolean hasEnergy;
        Waveform(long[] times, int[] amplitudes, long[] legacy, boolean energy) {
            this.times = times; this.amplitudes = amplitudes; this.legacy = legacy; this.hasEnergy = energy;
        }
    }
    private static final class InputError extends Exception {
        final String code;
        InputError(String code, String message) { super(message); this.code = code; }
    }
}
