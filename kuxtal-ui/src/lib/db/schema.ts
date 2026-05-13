import type { Database } from '@sqlite.org/sqlite-wasm';

type Migration = { version: number; up: string };

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up: `
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS onboarding (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        location TEXT,
        size_value TEXT,
        size_unit TEXT,
        climate TEXT,
        climate_note TEXT,
        goals TEXT,
        goal_note TEXT,
        challenges TEXT,
        challenge_note TEXT,
        structural TEXT,
        reminder TEXT,
        budget TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS land (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        boundary_geojson TEXT,
        boundary_closed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS zone (
        id TEXT PRIMARY KEY,
        land_id TEXT NOT NULL REFERENCES land(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        polygon_geojson TEXT NOT NULL,
        elevation_m REAL,
        soil_type TEXT,
        humidity_pct REAL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_zone_land ON zone(land_id);

      CREATE TABLE IF NOT EXISTS plant_species (
        id TEXT PRIMARY KEY,
        common_name TEXT NOT NULL,
        scientific_name TEXT,
        emoji TEXT,
        spacing_m REAL NOT NULL DEFAULT 1.0,
        sun TEXT,
        zones TEXT,
        plant_type TEXT,
        origin TEXT,
        functions TEXT,
        notes TEXT,
        source TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_species_origin ON plant_species(origin);

      CREATE TABLE IF NOT EXISTS planted (
        id TEXT PRIMARY KEY,
        land_id TEXT NOT NULL REFERENCES land(id) ON DELETE CASCADE,
        zone_id TEXT REFERENCES zone(id) ON DELETE SET NULL,
        species_id TEXT NOT NULL REFERENCES plant_species(id),
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        planted_at TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_planted_land ON planted(land_id);
      CREATE INDEX IF NOT EXISTS idx_planted_species ON planted(species_id);

      CREATE TABLE IF NOT EXISTS animal_species (
        id TEXT PRIMARY KEY,
        common_name TEXT NOT NULL,
        scientific_name TEXT,
        emoji TEXT,
        notes TEXT,
        source TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS animal_observation (
        id TEXT PRIMARY KEY,
        land_id TEXT NOT NULL REFERENCES land(id) ON DELETE CASCADE,
        species_id TEXT NOT NULL REFERENCES animal_species(id),
        zone_id TEXT REFERENCES zone(id) ON DELETE SET NULL,
        location_geojson TEXT,
        observed_at TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_animal_obs_land ON animal_observation(land_id);

      CREATE TABLE IF NOT EXISTS rule (
        id TEXT PRIMARY KEY,
        entity_a TEXT NOT NULL,
        entity_b TEXT,
        entity_a_kind TEXT NOT NULL,
        entity_b_kind TEXT,
        relationship TEXT NOT NULL,
        trigger_distance_m REAL,
        message TEXT NOT NULL,
        source TEXT,
        provenance_tag TEXT,
        attribution TEXT,
        retractable INTEGER NOT NULL DEFAULT 1,
        retracted_at TEXT,
        is_user_owned INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_rule_a ON rule(entity_a, entity_a_kind);
      CREATE INDEX IF NOT EXISTS idx_rule_b ON rule(entity_b, entity_b_kind);

      CREATE TABLE IF NOT EXISTS log_entry (
        id TEXT PRIMARY KEY,
        land_id TEXT REFERENCES land(id) ON DELETE SET NULL,
        kind TEXT NOT NULL,
        body TEXT,
        location_geojson TEXT,
        linked_plant_id TEXT REFERENCES planted(id) ON DELETE SET NULL,
        linked_zone_id TEXT REFERENCES zone(id) ON DELETE SET NULL,
        linked_species_id TEXT,
        media_blob_keys TEXT,
        recorded_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_log_recorded ON log_entry(recorded_at DESC);

      CREATE TABLE IF NOT EXISTS biodiversity_note (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS resource_item (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT,
        quantity REAL NOT NULL DEFAULT 0,
        unit TEXT,
        notes TEXT,
        last_updated TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS calendar_event (
        id TEXT PRIMARY KEY,
        calendar TEXT NOT NULL,
        date TEXT NOT NULL,
        kind TEXT NOT NULL,
        label TEXT,
        meta TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_calendar_date ON calendar_event(calendar, date);

      CREATE TABLE IF NOT EXISTS area_characteristic (
        id TEXT PRIMARY KEY,
        zone_id TEXT REFERENCES zone(id) ON DELETE CASCADE,
        scope TEXT NOT NULL,
        kind TEXT NOT NULL,
        period TEXT,
        value_num REAL,
        value_text TEXT,
        unit TEXT,
        recorded_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_area_zone ON area_characteristic(zone_id);

      CREATE TABLE IF NOT EXISTS goal (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS feedback_entry (
        id TEXT PRIMARY KEY,
        category TEXT,
        message TEXT NOT NULL,
        contact TEXT,
        created_at TEXT NOT NULL
      );
    `
  },
  {
    version: 2,
    up: `
      ALTER TABLE animal_species ADD COLUMN role TEXT;
      ALTER TABLE animal_species ADD COLUMN aliases TEXT;
      ALTER TABLE plant_species ADD COLUMN aliases TEXT;
      ALTER TABLE plant_species ADD COLUMN edible_parts TEXT;
      ALTER TABLE plant_species ADD COLUMN glyph TEXT;
      ALTER TABLE animal_species ADD COLUMN glyph TEXT;
    `
  },
  {
    version: 3,
    up: `
      CREATE TABLE IF NOT EXISTS water_feature (
        id TEXT PRIMARY KEY,
        land_id TEXT NOT NULL REFERENCES land(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        geometry_geojson TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_water_land ON water_feature(land_id);
    `
  },
  {
    version: 4,
    up: `
      ALTER TABLE land ADD COLUMN center_lat REAL;
      ALTER TABLE land ADD COLUMN center_lng REAL;
    `
  },
  {
    version: 5,
    up: `
      CREATE TABLE IF NOT EXISTS task (
        id TEXT PRIMARY KEY,
        land_id TEXT NOT NULL REFERENCES land(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        done INTEGER NOT NULL DEFAULT 0,
        target_id TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_task_land ON task(land_id);

      CREATE TABLE IF NOT EXISTS cosecha_entry (
        id TEXT PRIMARY KEY,
        land_id TEXT NOT NULL REFERENCES land(id) ON DELETE CASCADE,
        planted_id TEXT REFERENCES planted(id) ON DELETE CASCADE,
        amount_kg REAL NOT NULL,
        quality TEXT,
        harvest_date TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cosecha_land ON cosecha_entry(land_id);
    `
  },
  {
    version: 6,
    up: `
      ALTER TABLE plant_species ADD COLUMN image_url TEXT;
      ALTER TABLE animal_species ADD COLUMN image_url TEXT;
      ALTER TABLE log_entry ADD COLUMN title TEXT;
    `
  },
  {
    version: 7,
    up: `
      ALTER TABLE log_entry ADD COLUMN author TEXT;
      ALTER TABLE cosecha_entry ADD COLUMN author TEXT;
      ALTER TABLE cosecha_entry ADD COLUMN location_geojson TEXT;
      ALTER TABLE task ADD COLUMN author TEXT;
      ALTER TABLE task ADD COLUMN location_geojson TEXT;
      ALTER TABLE task ADD COLUMN scheduled_at TEXT;
    `
  }
];

export async function runMigrations(db: Database): Promise<void> {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);`);

  let current = 0;
  db.exec({
    sql: 'SELECT COALESCE(MAX(version), 0) AS v FROM schema_version',
    rowMode: 'object',
    callback: (row: any) => {
      current = row.v as number;
    }
  });

  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;
    db.exec('BEGIN');
    try {
      db.exec(m.up);
      db.exec({ sql: 'INSERT INTO schema_version(version) VALUES (?)', bind: [m.version] });
      db.exec('COMMIT');
      console.log(`[sqlite] migrated to v${m.version}`);
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}
