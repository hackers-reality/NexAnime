'use client';

import Link from 'next/link';
import type { AniListCharacter } from '@/lib/anilist';
import styles from './CharacterClient.module.css';

export default function CharacterClient({ character }: { character: AniListCharacter }) {
  const mediaAppearances = character.media?.edges || [];
  const voiceActors = character.voiceActors || [];

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.imageWrap}>
          <img
            src={character.image?.large || '/avatars/default.svg'}
            alt={character.name.full}
            className={styles.image}
            onError={(e) => { (e.target as HTMLImageElement).src = '/avatars/default.svg'; }}
          />
        </div>

        <div className={styles.info}>
          <h1 className={styles.name}>{character.name.full}</h1>
          {character.name.native && (
            <p className={styles.nativeName}>{character.name.native}</p>
          )}

          <div className={styles.details}>
            {character.gender && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Gender</span>
                <span className={styles.detailValue}>{character.gender}</span>
              </div>
            )}
            {character.age && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Age</span>
                <span className={styles.detailValue}>{character.age}</span>
              </div>
            )}
            {character.bloodType && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Blood Type</span>
                <span className={styles.detailValue}>{character.bloodType}</span>
              </div>
            )}
            {character.favourites != null && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Favourites</span>
                <span className={styles.detailValue}>{character.favourites.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {character.description && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>About</h2>
          <p className={styles.description}>{character.description}</p>
        </div>
      )}

      {voiceActors.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Voice Actors</h2>
          <div className={styles.vaGrid}>
            {voiceActors.map((va) => (
              <div key={va.id} className={styles.vaCard}>
                <img
                  src={va.image?.large || '/avatars/default.svg'}
                  alt={va.name.full}
                  className={styles.vaImage}
                  onError={(e) => { (e.target as HTMLImageElement).src = '/avatars/default.svg'; }}
                />
                <div className={styles.vaInfo}>
                  <span className={styles.vaName}>{va.name.full}</span>
                  {va.language && <span className={styles.vaLang}>{va.language}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {mediaAppearances.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Appears In</h2>
          <div className={styles.mediaGrid}>
            {mediaAppearances.map((edge) => (
              <Link
                key={edge.node.id}
                href={`/anime/${edge.node.id}`}
                className={styles.mediaCard}
              >
                <div className={styles.mediaImage}>
                  <img
                    src={edge.node.coverImage?.large || '/logo.svg'}
                    alt=""
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/logo.svg'; }}
                  />
                </div>
                <div className={styles.mediaInfo}>
                  <span className={styles.mediaTitle}>
                    {edge.node.title?.english || edge.node.title?.romaji || 'Unknown'}
                  </span>
                  <div className={styles.mediaMeta}>
                    <span className={styles.mediaRole}>{edge.role}</span>
                    {edge.node.format && (
                      <span className={styles.mediaFormat}>{edge.node.format}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
