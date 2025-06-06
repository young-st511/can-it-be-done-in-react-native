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

vec2 rotate(in vec2 coord, in float angle, vec2 origin) {
  vec2 coord1 = coord - origin;
  vec2 rotated = coord1 * mat2( cos(angle), -sin(angle),
                                sin(angle),  cos(angle));
  return rotated + origin;
}

vec4 main(vec2 xy) {
  return image.eval(xy);
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

  useEffect(() => {
    trim.value = withTiming(1, { duration: 3000 });
  }, []);

  if (!clip) return null;

  return (
    <Group transform={[{ rotate: -Math.PI / 2 }]} origin={center}>
      <Group clip={clip}>
        <Fill color={background} />
        <Circle c={fullPath.getPoint(0)} r={strokeWidth / 2} color={colors[0]} />
        <Path path={trimmedPath} strokeWidth={strokeWidth} style={'stroke'} color={colors[0]} />
        <Circle c={trimmedPathLastPt} r={strokeWidth / 2} color={colors[0]} />
      </Group>
    </Group>
  );
};
