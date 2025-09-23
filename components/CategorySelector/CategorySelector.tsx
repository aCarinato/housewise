'use client';

import { memo } from 'react';
import styles from './CategorySelector.module.css';

export type CategoryInfo = {
  id: string;
  label: string;
  description: string;
};

type CategorySelectorProps = {
  categories: CategoryInfo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const CategorySelector = memo(({ categories, selectedId, onSelect }: CategorySelectorProps) => (
  <div className={styles.grid}>
    {categories.map((category) => {
      const isActive = category.id === selectedId;
      return (
        <button
          key={category.id}
          type="button"
          className={`${styles.card} ${isActive ? styles.active : ''}`}
          onClick={() => onSelect(category.id)}
        >
          <div className={styles.icon} aria-hidden>🏷️</div>
          <h3>{category.label}</h3>
          <p>{category.description}</p>
        </button>
      );
    })}
  </div>
));

CategorySelector.displayName = 'CategorySelector';

export default CategorySelector;
