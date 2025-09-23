import { ReactNode } from 'react';
import styles from './Card.module.css';

type CardProps = {
  children: ReactNode;
  title?: string;
  subdued?: boolean;
};

const Card = ({ children, title, subdued = false }: CardProps) => (
  <div className={`${styles.card}${subdued ? ` ${styles.subdued}` : ''}`}>
    {title ? <h2 className={styles.title}>{title}</h2> : null}
    <div className={styles.content}>{children}</div>
  </div>
);

export default Card;
