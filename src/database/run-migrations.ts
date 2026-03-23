import { dataSource } from './data-source';

async function run(): Promise<void> {
  try {
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }

    const migrations = await dataSource.runMigrations();
    if (migrations.length > 0) {
      console.log(`Applied ${migrations.length} migration(s).`);
      for (const migration of migrations) {
        console.log(`- ${migration.name}`);
      }
    } else {
      console.log('No pending migrations.');
    }
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

run().catch((error) => {
  console.error('Migration run failed:', error);
  process.exit(1);
});
