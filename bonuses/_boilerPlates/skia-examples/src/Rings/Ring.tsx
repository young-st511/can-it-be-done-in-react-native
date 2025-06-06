import {
  Circle,
  Group,
  Path,
  Skia,
  SweepGradient,
  type Vector,
  Shadow,
  PathOp,
  Shader,
  Fill,
  mixColors,
} from '@shopify/react-native-skia';
import React, { useEffect, useMemo } from 'react';
import { useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';

import { frag } from '../components';

const source = frag`
uniform shader image;
uniform vec2 head;
uniform float progress;
uniform vec4 color;
uniform float radius;

vec2 rotate(in vec2 coord, in float angle, vec2 origin) {
  vec2 coord1 = coord - origin;
  vec2 rotated = coord1 * mat2( cos(angle), -sin(angle),
                                sin(angle),  cos(angle));
  return rotated + origin;
}

vec4 main(vec2 xy) {
  float d = distance(xy, head);
  vec2 rotated = rotate(xy, -${Math.PI} - progress * ${2 * Math.PI}, head);
  if (rotated.y > head.y) {
    return vec4(0, 0, 0, 0);
  }
  if(d > radius) {
    return vec4(0, 0, 0, smoothstep(radius * 1.65, 0, d));
  }
  
  if(progress > 1.0) {
    return color;
  }
  
  return image.eval(head);
}
`;

const fromCircle = (center: Vector, r: number) => {
  'worklet';
  return Skia.XYWHRect(center.x - r, center.y - r, r * 2, r * 2);
};

interface Ring {
  colors: string[];
  background: string;
  size: number;
  totalProgress: number;
}

interface RingProps {
  ring: Ring;
  center: Vector;
  strokeWidth: number;
}

export const Ring = ({ center, strokeWidth, ring: { size, background, totalProgress, colors } }: RingProps) => {
  const trim = useSharedValue(0);

  const emptyRadius = size / 2 - strokeWidth / 2;

  const clip = useMemo(() => {
    const outerCircle = Skia.Path.Make();
    outerCircle.addCircle(center.x, center.y, size / 2);

    const innerCircle = Skia.Path.Make();
    innerCircle.addCircle(center.x, center.y, size / 2 - strokeWidth);

    return Skia.Path.MakeFromOp(outerCircle, innerCircle, PathOp.Difference);
  }, [center.x, center.y, size]);

  const fullPath = useMemo(() => {
    const path = Skia.Path.Make();
    const fullRevolutions = Math.floor(totalProgress);
    for (let i = 0; i < fullRevolutions; i++) {
      path.addCircle(center.x, center.y, emptyRadius);
    }
    path.addArc(fromCircle(center, emptyRadius), 0, 360 * (totalProgress % 1));
    return path;
  }, []);

  const trimmedPath = useDerivedValue(() => {
    if (trim.value < 1) return fullPath.copy().trim(0, trim.value, false) ?? fullPath;
    else return fullPath;
  });

  const trimmedPathLastPt = useDerivedValue(() => {
    return trimmedPath.value.getLastPt();
  });

  const headClip = useDerivedValue(() => {
    const c = trimmedPathLastPt.value;
    const _progress = trim.value * totalProgress;

    const _path = Skia.Path.Make();
    _path.addRect(Skia.XYWHRect(c.x - strokeWidth, c.y, strokeWidth * 2, strokeWidth * 2));

    const _matrix = Skia.Matrix();
    const _angle = (_progress % 1) * 2 * Math.PI;
    _matrix.translate(c.x, c.y);
    _matrix.rotate(_angle);
    _matrix.translate(-c.x, -c.y);

    _path.transform(_matrix);
    return _path;
  });

  const matrix = useDerivedValue(() => {
    const _matrix = Skia.Matrix();
    const progress = trim.value * totalProgress;
    const angle = progress < 1 ? 0 : (progress % 1) * 2 * Math.PI;

    if (angle > 0) {
      _matrix.translate(center.x, center.y);
      _matrix.rotate(angle);
      _matrix.translate(-center.x, -center.y);
    }
    return _matrix;
  });

  const uniforms = useDerivedValue(() => {
    const head = trimmedPath.value.getLastPt();

    return {
      head: head,
      radius: strokeWidth / 2,
      progress: trim.value * totalProgress,
      color: [...Skia.Color(colors[1])],
    };
  });

  useEffect(() => {
    trim.value = withTiming(1, { duration: 3000 });
  }, []);

  if (!clip) return null;

  return (
    <Group transform={[{ rotate: -Math.PI / 2 }]} origin={center}>
      <Group clip={clip}>
        <Fill color={background} />
        <Circle c={fullPath.getPoint(0)} r={strokeWidth / 2} color={colors[0]} />
        <Path path={trimmedPath} strokeWidth={strokeWidth} style={'stroke'} color={colors[0]}>
          <SweepGradient c={center} colors={colors} matrix={matrix} />
        </Path>
        <Fill>
          <Shader source={source} uniforms={uniforms}>
            <SweepGradient c={center} colors={colors} matrix={matrix} />
          </Shader>
        </Fill>
      </Group>
    </Group>
  );
};
