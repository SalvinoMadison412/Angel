"use client";

import { useState } from "react";

export default function FounderAvatar({
  name,
  initials,
  photoSrc,
}: {
  name: string;
  initials: string;
  photoSrc?: string;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = photoSrc && !photoFailed;

  if (showPhoto) {
    return (
      <div className="relative h-[120px] w-[120px] shrink-0 overflow-hidden rounded-full border-2 border-accent">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoSrc}
          alt={name}
          className="h-full w-full object-cover object-[center_top]"
          onError={() => setPhotoFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className="bracket-corner flex h-[120px] w-[120px] shrink-0 items-center justify-center border border-glass bg-gradient-to-br from-accent/25 via-glass-fill to-transparent">
      <span className="font-heading-mono text-xl font-bold text-white">{initials}</span>
    </div>
  );
}
