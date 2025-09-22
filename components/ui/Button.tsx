import { ReactNode } from 'react';
import styles from './Button.module.css';

type ButtonProps = {
  children: ReactNode;
  variant?: 'primary' | 'secondary';
  onClick?: () => void;
};

const Button = ({ children, variant = 'primary', onClick }: ButtonProps) => {
  const variantClass =
    variant === 'secondary' ? styles.secondary : styles.primary;

  return (
    <button
      type="button"
      className={`${styles.button} ${variantClass}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

export default Button;
