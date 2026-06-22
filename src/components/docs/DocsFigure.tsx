'use client';

import React from 'react';
import Image from 'next/image';

export interface DocsFigureProps {
  src: string;
  alt: string;
  caption?: string;
}

export function DocsFigure({ src, alt, caption }: DocsFigureProps) {
  return (
    <figure className="my-6">
      <div className="rounded-lg border border-dark-border overflow-hidden bg-dark-surface shadow-lg">
        <Image
          src={src}
          alt={alt}
          width={960}
          height={540}
          className="w-full h-auto"
          sizes="(max-width: 768px) 100vw, 720px"
        />
      </div>
      {caption != null && caption.length > 0 && (
        <figcaption className="text-xs text-dark-textSecondary mt-2 leading-relaxed text-center px-2">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
