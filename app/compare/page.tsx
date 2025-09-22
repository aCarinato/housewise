import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import styles from './page.module.css';

const ComparePage = () => {
  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1>Confronta Preventivi</h1>
      </div>
      <Card>
        <p className={styles.placeholder}>Area confronto in arrivo</p>
      </Card>
      <div className={styles.actions}>
        <Button>Analizza</Button>
      </div>
    </main>
  );
};

export default ComparePage;
