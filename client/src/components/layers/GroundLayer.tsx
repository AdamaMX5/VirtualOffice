import React from 'react';
import { Layer, Rect } from 'react-konva';
import { P, MAP } from '../../model/constants';

const GroundLayer = React.memo(({ x, y, scaleX, scaleY }: {
  x: number; y: number; scaleX: number; scaleY: number;
}) => (
  <Layer x={x} y={y} scaleX={scaleX} scaleY={scaleY}>
    {/* Außenfläche – sehr dunkles Grün, kein Gras */}
    <Rect x={0} y={0} width={MAP.w * P} height={MAP.h * P} fill="#0f1a10" />
  </Layer>
));

GroundLayer.displayName = 'GroundLayer';
export default GroundLayer;
