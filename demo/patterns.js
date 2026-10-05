globalThis.SupereoDemoPatterns = {
  "gentle-selection": {
    "version": 1,
    "events": [
      {
        "timeMs": 0,
        "type": "transient",
        "intensity": 0.2,
        "sharpness": 0.4
      }
    ]
  },
  "rising-success": {
    "version": 1,
    "events": [
      {
        "timeMs": 0,
        "type": "transient",
        "intensity": 0.25,
        "sharpness": 0.45
      },
      {
        "timeMs": 95,
        "type": "transient",
        "intensity": 0.5,
        "sharpness": 0.6
      },
      {
        "timeMs": 210,
        "type": "transient",
        "intensity": 0.85,
        "sharpness": 0.75
      }
    ]
  },
  "double-warning": {
    "version": 1,
    "events": [
      {
        "timeMs": 0,
        "type": "transient",
        "intensity": 0.5,
        "sharpness": 0.7
      },
      {
        "timeMs": 115,
        "type": "transient",
        "intensity": 0.65,
        "sharpness": 0.7
      }
    ]
  },
  "soft-pulse": {
    "version": 1,
    "events": [
      {
        "timeMs": 0,
        "type": "continuous",
        "durationMs": 700,
        "intensity": 0.15,
        "sharpness": 0.2,
        "curves": {
          "intensity": [
            {
              "timeMs": 0,
              "value": 0.05
            },
            {
              "timeMs": 200,
              "value": 0.45
            },
            {
              "timeMs": 360,
              "value": 0.75
            },
            {
              "timeMs": 700,
              "value": 0
            }
          ],
          "sharpness": [
            {
              "timeMs": 0,
              "value": 0.15
            },
            {
              "timeMs": 350,
              "value": 0.3
            },
            {
              "timeMs": 700,
              "value": 0.1
            }
          ]
        }
      }
    ]
  }
};
