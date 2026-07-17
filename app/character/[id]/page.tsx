import { notFound } from 'next/navigation';
import { getCharacterById } from '@/lib/anilist';
import CharacterClient from '@/components/character/CharacterClient';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const character = await getCharacterById(Number(id));
  if (!character) return { title: 'Character — NexAnime' };

  return {
    title: `${character.name.full} — NexAnime`,
    description: `Info about ${character.name.full} — anime characters, voice actors, and appearances.`,
  };
}

export default async function CharacterPage({ params }: Props) {
  const { id } = await params;
  const character = await getCharacterById(Number(id));
  if (!character) notFound();

  return <CharacterClient character={character} />;
}
