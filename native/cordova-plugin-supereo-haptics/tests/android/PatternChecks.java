package com.supereo.haptics;

import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.Arrays;
import org.json.JSONObject;

/** JVM checks of the actual native validator and waveform compiler, never a device test. */
public final class PatternChecks {
    private static int assertions = 0;
    private static final Class<?> BRIDGE;
    private static final Method VALIDATE, WAVEFORM;
    static {
        try {
            BRIDGE = Class.forName("com.supereo.haptics.SupereoHaptics");
            VALIDATE = BRIDGE.getDeclaredMethod("validatePattern", JSONObject.class);
            VALIDATE.setAccessible(true);
            Class<?> pattern = Class.forName("com.supereo.haptics.SupereoHaptics$Pattern");
            WAVEFORM = BRIDGE.getDeclaredMethod("waveform", pattern, double.class, boolean.class);
            WAVEFORM.setAccessible(true);
        } catch (Exception error) { throw new ExceptionInInitializerError(error); }
    }
    private static Object pattern(String events) throws Exception {
        return VALIDATE.invoke(null, new JSONObject("{\"version\":1,\"events\":" + events + "}"));
    }
    private static Object waveform(String events, double strength, boolean amplitude) throws Exception {
        return WAVEFORM.invoke(null, pattern(events), strength, amplitude);
    }
    private static Object field(Object target, String name) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        return field.get(target);
    }
    private static void expect(boolean condition, String name) {
        assertions++;
        if (!condition) throw new AssertionError(name);
    }
    private static void rejects(String events, String name) throws Exception {
        try { pattern(events); throw new AssertionError("accepted invalid input: " + name); }
        catch (InvocationTargetException error) {
            expect(error.getCause().getClass().getSimpleName().equals("InputError") ||
                    error.getCause() instanceof org.json.JSONException, name);
        }
    }
    private static String tap(int time, String intensity) {
        return "{\"timeMs\":" + time + ",\"type\":\"transient\",\"intensity\":" + intensity + "}";
    }
    public static void main(String[] args) throws Exception {
        Object basic = waveform("[{\"timeMs\":0,\"type\":\"continuous\",\"durationMs\":10,\"intensity\":0.5}]", 1, true);
        expect(Arrays.equals((long[]) field(basic, "times"), new long[]{10}), "equal amplitude segments merge");
        expect(Arrays.equals((int[]) field(basic, "amplitudes"), new int[]{128}), "normalized amplitude maps to 0..255");
        expect((boolean) field(basic, "hasEnergy"), "nonzero waveform energy");

        Object legacy = waveform("[{\"timeMs\":10,\"type\":\"continuous\",\"durationMs\":10,\"intensity\":0.1}]", .2, false);
        expect(Arrays.equals((long[]) field(legacy, "times"), new long[]{10, 10}), "initial delay retained");
        expect(Arrays.equals((int[]) field(legacy, "amplitudes"), new int[]{0, -1}), "basic motors use default amplitude");
        expect(Arrays.equals((long[]) field(legacy, "legacy"), new long[]{10, 10}), "legacy off/on timeline");

        Object zero = waveform("[" + tap(0, "1") + "]", 0, true);
        expect(!(boolean) field(zero, "hasEnergy"), "zero strength is silent");

        Object overlaps = waveform("[" + tap(0, "0.3") + ",{\"timeMs\":0,\"type\":\"continuous\",\"durationMs\":40,\"intensity\":0.6}]", 1, true);
        expect(Arrays.equals((long[]) field(overlaps, "times"), new long[]{40}), "overlap preserves duration");
        expect(Arrays.equals((int[]) field(overlaps, "amplitudes"), new int[]{153}), "simultaneous events use maximum intensity");

        Object curve = waveform("[{\"timeMs\":0,\"type\":\"continuous\",\"durationMs\":40,\"intensity\":0,\"curves\":{\"intensity\":[{\"timeMs\":0,\"value\":0},{\"timeMs\":40,\"value\":1}]}}]", .5, true);
        int[] curveValues = (int[]) field(curve, "amplitudes");
        expect(curveValues.length == 8 && curveValues[0] == 8 && curveValues[7] == 120, "curve interpolation and overall scaling");
        expect(Arrays.stream((long[]) field(curve, "times")).sum() == 40, "curve exact timeline duration");

        Object late = pattern("[" + tap(9988, "1") + "]");
        expect(((Integer) field(late, "duration")) == 10000, "bounded maximum transient tail");
        rejects("[" + tap(9989, "1") + "]", "reject tail past maximum");
        rejects("[]", "reject empty pattern");
        rejects("[" + tap(0, "-0.1") + "]", "reject negative intensity");
        rejects("[" + tap(0, "1.1") + "]", "reject high intensity");
        rejects("[" + tap(0, "\"0.5\"") + "]", "reject numeric strings");
        rejects("[{\"timeMs\":0.1,\"type\":\"transient\",\"intensity\":1}]", "reject fractional times");
        rejects("[{\"timeMs\":0,\"type\":\"transient\",\"intensity\":1,\"durationMs\":20}]", "reject duration on transient");
        rejects("[{\"timeMs\":0,\"type\":\"continuous\",\"durationMs\":0,\"intensity\":1}]", "reject zero duration");
        rejects("[{\"timeMs\":0,\"type\":\"transient\",\"intensity\":1,\"repeat\":true}]", "reject infinite pattern field");
        rejects("[{\"timeMs\":0,\"type\":\"continuous\",\"durationMs\":10,\"intensity\":0.5,\"curves\":{}}]", "reject empty curves");
        rejects("[{\"timeMs\":0,\"type\":\"transient\",\"intensity\":0.5,\"curves\":{\"intensity\":[{\"timeMs\":0,\"value\":1}]}}]", "reject transient curves");
        rejects("[{\"timeMs\":0,\"type\":\"continuous\",\"durationMs\":10,\"intensity\":0.5,\"curves\":{\"intensity\":[{\"timeMs\":4,\"value\":1},{\"timeMs\":4,\"value\":0}]}}]", "reject duplicate curve times");
        rejects("[{\"timeMs\":0,\"type\":\"continuous\",\"durationMs\":10,\"intensity\":0.5,\"curves\":{\"intensity\":[{\"timeMs\":11,\"value\":1}]}}]", "reject out of event curve times");
        StringBuilder many = new StringBuilder("[");
        for (int i = 0; i < 65; i++) { if (i > 0) many.append(','); many.append(tap(i, "1")); }
        many.append(']');
        rejects(many.toString(), "reject more than 64 events");
        System.out.println("PASS: " + assertions + " actual Android validator/waveform JVM assertions. No device APIs executed.");
    }
}
