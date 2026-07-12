'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import styles from './page.module.css';

interface Character {
  id: number;
  name: { full: string };
  image: { large: string };
}

export default function OnboardingPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [aboutMe, setAboutMe] = useState('');
  
  // Avatar search & selection
  const [searchQuery, setSearchQuery] = useState('');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [loadingChars, setLoadingChars] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial popular characters
  useEffect(() => {
    fetchCharacters('');
  }, []);

  const fetchCharacters = async (query: string) => {
    setLoadingChars(true);
    try {
      const res = await fetch('/api/anilist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'searchCharacters',
          search: query || undefined,
          page: 1,
          perPage: 24,
        }),
      });
      const data = await res.json();
      if (data.characters) {
        setCharacters(data.characters);
        // Default to the first character if none is selected
        if (!selectedChar && data.characters.length > 0 && !query) {
          setSelectedChar(data.characters[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load characters:', err);
    } finally {
      setLoadingChars(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    // Debounce/Fetch immediately on change for responsiveness
    fetchCharacters(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError('Display Name is required.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim(),
          pronouns: pronouns.trim() || null,
          aboutMe: aboutMe.trim() || null,
          avatarCharId: selectedChar?.id || null,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Force fully reload or navigate to root layout to re-run layout checks
        window.location.href = '/';
      } else {
        setError(data.error || 'Failed to complete onboarding. Please try again.');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.onboardingContainer}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logoMark}>
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 20 L80 50 L20 80 Z" fill="var(--primary)" />
              <path d="M50 35 L80 50 L50 65" stroke="var(--bg-base)" strokeWidth="6" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className={styles.title}>Welcome to NexAnime</h1>
          <p className={styles.subtitle}>Let's set up your local anime profile</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.errorBanner}>{error}</div>}

          <div className={styles.gridContainer}>
            {/* Form Fields */}
            <div className={styles.fieldsCol}>
              <div className={styles.inputGroup}>
                <label htmlFor="displayName">Display Name <span className={styles.required}>*</span></label>
                <input
                  type="text"
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. SpikeSpiegel"
                  required
                  disabled={submitting}
                />
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="pronouns">Pronouns <span className={styles.optional}>(Optional)</span></label>
                <input
                  type="text"
                  id="pronouns"
                  value={pronouns}
                  onChange={(e) => setPronouns(e.target.value)}
                  placeholder="e.g. they/them"
                  disabled={submitting}
                />
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="aboutMe">About Me <span className={styles.optional}>(Optional)</span></label>
                <textarea
                  id="aboutMe"
                  value={aboutMe}
                  onChange={(e) => setAboutMe(e.target.value)}
                  placeholder="Tell us about yourself..."
                  rows={4}
                  disabled={submitting}
                />
              </div>
            </div>

            {/* Avatar Picker Column */}
            <div className={styles.avatarCol}>
              <label>Select Avatar <span className={styles.required}>*</span></label>
              
              <div className={styles.searchBox}>
                <input
                  type="text"
                  placeholder="Search characters (e.g. Luffy, Zoro)..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  disabled={submitting}
                />
              </div>

              <div className={styles.avatarGridWrapper}>
                {loadingChars ? (
                  <div className={styles.loadingAvatars}>
                    <div className={styles.spinner} />
                  </div>
                ) : (
                  <div className={styles.avatarGrid}>
                    {characters.map((char) => {
                      const isSelected = selectedChar?.id === char.id;
                      return (
                        <button
                          key={char.id}
                          type="button"
                          className={`${styles.avatarItem} ${isSelected ? styles.selectedAvatar : ''}`}
                          onClick={() => setSelectedChar(char)}
                          disabled={submitting}
                          title={char.name.full}
                        >
                          <div className={styles.avatarImgContainer}>
                            <Image
                              src={char.image.large}
                              alt={char.name.full}
                              fill
                              sizes="80px"
                              className={styles.avatarImg}
                            />
                          </div>
                        </button>
                      );
                    })}
                    {characters.length === 0 && (
                      <p className={styles.emptyGrid}>No characters found</p>
                    )}
                  </div>
                )}
              </div>

              {selectedChar && (
                <div className={styles.selectedCharPreview}>
                  Selected: <strong>{selectedChar.name.full}</strong>
                </div>
              )}
            </div>
          </div>

          <button type="submit" className={styles.submitBtn} disabled={submitting}>
            {submitting ? 'Setting up...' : 'Complete Onboarding'}
          </button>
        </form>
      </div>
    </div>
  );
}
