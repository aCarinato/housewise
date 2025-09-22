import { ReactNode } from 'react';
import styles from './Card.module.css';

type CardProps = {
  children: ReactNode;
  title?: string;
};

const Card = ({ children, title }: CardProps) => (
  <div className={styles.card}>
    {title ? <h2 className={styles.title}>{title}</h2> : null}
    <div className={styles.content}>{children}</div>
  </div>
);

export default Card;
