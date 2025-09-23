import { ReactNode } from 'react';
import styles from './Button.module.css';

type ButtonProps = {
  children: ReactNode;
  variant?: 'primary' | 'secondary';
  onClick?: () => void;
  disabled?: boolean;
};

const Button = ({ children, variant = 'primary', onClick, disabled }: ButtonProps) => {
  const variantClass =
    variant === 'secondary' ? styles.secondary : styles.primary;

  return (
    <button
      type="button"
      className={`${styles.button} ${variantClass}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export default Button;
