import { useEffect, useState } from 'react';
import { getDownloadURL, ref } from 'firebase/storage';
import { cn } from '@mwilliams/ui';
import { storage } from '../lib/firebase';
import type { Dog } from '../lib/types';

const urlCache = new Map<string, string>();

export function useStorageUrl(path?: string) {
  const [url, setUrl] = useState<string | null>(path ? urlCache.get(path) ?? null : null);
  useEffect(() => {
    if (!path) return setUrl(null);
    if (urlCache.has(path)) return setUrl(urlCache.get(path)!);
    let live = true;
    getDownloadURL(ref(storage, path))
      .then((u) => {
        urlCache.set(path, u);
        if (live) setUrl(u);
      })
      .catch(() => live && setUrl(null));
    return () => {
      live = false;
    };
  }, [path]);
  return url;
}

// Soft, natural tints so dogs without photos are still easy to tell apart.
const tints = [
  ['#e3ead9', '#34452a'],
  ['#f5ead7', '#6d4b0b'],
  ['#e1ebef', '#2c4757'],
  ['#f2e2da', '#7f3219'],
  ['#e8e4d3', '#4a4a24'],
  ['#e6e0ec', '#4b3b5c'],
];

function tintFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return tints[h % tints.length];
}

const sizes = {
  sm: 'size-10 text-base rounded-[0.875rem]',
  md: 'size-14 text-xl rounded-[1.1rem]',
  lg: 'size-24 text-4xl rounded-[1.75rem]',
  xl: 'size-32 text-5xl rounded-[2rem] sm:size-40 sm:text-6xl',
};

export function DogAvatar({ dog, size = 'md', className }: { dog: Pick<Dog, 'name' | 'photoPath'>; size?: keyof typeof sizes; className?: string }) {
  const url = useStorageUrl(dog.photoPath);
  const [bg, fg] = tintFor(dog.name);
  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center overflow-hidden font-serif font-medium select-none', sizes[size], className)}
      style={url ? undefined : { background: bg, color: fg }}
      aria-hidden
    >
      {url ? <img src={url} alt="" className="size-full object-cover" loading="lazy" /> : dog.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function ClientInitials({ first, last, className }: { first: string; last: string; className?: string }) {
  return (
    <span aria-hidden className={cn('inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-mist text-sm font-bold text-olive', className)}>
      {(first[0] ?? '').toUpperCase()}
      {(last[0] ?? '').toUpperCase()}
    </span>
  );
}
