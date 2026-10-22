'use client';

import React from 'react';

interface CompanyAvatarProps {
  name: string;
  logoPath?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base'
};

const LOGO_BUCKET = 'company-logos';

function stringToColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 45%, 85%)`;
}

function getInitials(name: string) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  if (words.length === 1 && words[0].length >= 2) return `${words[0][0]}${words[0][1]}`.toUpperCase();
  if (words.length === 1) return words[0][0].toUpperCase();
  return '?';
}

/**
 * `logo_path` may be stored either as a bare Supabase Storage object path
 * ("acme/logo.png") or as a fully-qualified URL. Resolve both to a usable src.
 */
export function resolveLogoUrl(logoPath?: string | null): string | null {
  if (!logoPath) return null;
  const trimmed = logoPath.trim();
  if (!trimmed) return null;
  if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith('data:')) return trimmed;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/storage/v1/object/public/${LOGO_BUCKET}/${trimmed.replace(/^\/+/, '')}`;
}

export function CompanyAvatar({ name, logoPath, size = 'md', className = '' }: CompanyAvatarProps) {
  const [failed, setFailed] = React.useState(false);
  const sClass = sizeClasses[size];
  const src = resolveLogoUrl(logoPath);
  const showImage = Boolean(src) && !failed;

  React.useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <div
      className={`relative flex-shrink-0 overflow-hidden flex items-center justify-center font-semibold text-[var(--color-text)] ${sClass} ${className}`}
      style={{ backgroundColor: showImage ? 'transparent' : stringToColor(name || '') }}
    >
      {showImage ? (
        // A plain <img> avoids next/image's host allow-list, which previously threw
        // an unrecoverable render error for Supabase-hosted logos.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src as string}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{getInitials(name)}</span>
      )}
      <span className="sr-only">{name}</span>
    </div>
  );
}
