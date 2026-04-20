import React from 'react';
import { Group, Rect, Shape, Text } from 'react-konva';
import { P } from '../../model/constants';

interface ChatBubbleProps {
  x: number; // Welt-X in Tile-Einheiten
  y: number;
  text: string;
}

const ChatBubble = React.memo(({ x, y, text }: ChatBubbleProps) => {
  const len      = text.length;
  const fontSize = len > 100 ? 9 : len > 55 ? 10 : 11;
  const bW       = 160;
  const padX     = 8;
  const padY     = 6;
  const innerW   = bW - padX * 2;
  const charsPerLine = Math.floor(innerW / (fontSize * 0.58));
  const numLines     = Math.min(Math.ceil(len / charsPerLine), 5);
  const lineH        = fontSize + 3;
  const bH           = numLines * lineH + padY * 2;
  const bX           = -bW / 2;
  const bY           = -32 - bH;

  return (
    <Group x={x * P} y={y * P}>
      <Rect
        x={bX} y={bY}
        width={bW} height={bH}
        fill="rgba(255,255,255,0.96)"
        cornerRadius={8}
        shadowColor="rgba(0,0,0,0.25)"
        shadowBlur={6}
        shadowOffsetY={2}
      />
      <Shape
        sceneFunc={(ctx, shape) => {
          ctx.beginPath();
          ctx.moveTo(-7, -32);
          ctx.lineTo(7, -32);
          ctx.lineTo(0, -22);
          ctx.closePath();
          ctx.fillShape(shape);
        }}
        fill="rgba(255,255,255,0.96)"
      />
      <Text
        text={text}
        fontSize={fontSize}
        fontStyle="bold"
        fill="#1e293b"
        x={bX + padX} y={bY + padY}
        width={innerW}
        height={numLines * lineH}
        align="center"
        wrap="word"
      />
    </Group>
  );
});

ChatBubble.displayName = 'ChatBubble';
export default ChatBubble;
