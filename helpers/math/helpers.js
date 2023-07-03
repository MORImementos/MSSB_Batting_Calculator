export function valueToDegrees(v) {
    return (v / 4096) * 360;
  }
  
export function degreesToRadians(d) {
    return (d * Math.PI) / 180;
}

export function degreeToPoint(d, length) {
    return {
        X: Math.cos(degreesToRadians(d)) * length,
        Y: -Math.sin(degreesToRadians(d)) * length,
    };
}

export function average(array1) {
  let sum = 0;
  for (let i = 0; i < array1.length; i++) {
    sum += array1[i];
  }
  return sum / array1.length;
}

export function anglesToArc(vals, flip = false) {
    let selectedAngle1 = degreesToRadians(360 - valueToDegrees(vals[0]));
    let selectedAngle2 = degreesToRadians(360 - valueToDegrees(vals[1]));
  
    if (flip) {
      selectedAngle1 = Math.PI - selectedAngle1;
      selectedAngle2 = Math.PI - selectedAngle2;
    }
    let selectedAngleBegin = Math.min(selectedAngle1, selectedAngle2);
    let selectedAngleEnd = Math.max(selectedAngle1, selectedAngle2);
    return [selectedAngleBegin, selectedAngleEnd];
  }

export function floor(f) {
    return Math.trunc(f);
  }

export function linearInterpolateToNewRange(value, previousMin, previousMax, nextMin, nextMax) {
    let max = 1.0

    if (previousMin  !== previousMax) {
        max = (value - previousMin) / (previousMax - previousMin)
        max = Math.max(max, 1.0)
    }

    return (nextMax - nextMin) * max + nextMin
}

// possible that this isn't the same as original, need to double check
export function adjustAngle(angle) {
    if (angle < 0) {
        angle = (angle % 0x1000) + 0x1000
    } else if (0xfff < angle) {
        angle = (angle % 0x1000)
    }
    return angle
  }

// possible that this isn't the same as original, need to double check
export function mssbConvertToRadians(param_1) {
    if (param_1 < 0) {
        param_1 = (param_1 % 0x1000) + 0x1000;
      } else if (param_1 > 0xFFF) {
        param_1 = (param_1 % 0x1000);
      }
      let dVar1 = (Math.PI * param_1 * 2) / 0x1000;
      if (Math.PI < dVar1) {
        dVar1 -= 2 * Math.PI;
      }
      return dVar1;
  }