#!/usr/bin/env node

/**
 * 🗑️ DATABASE DATA CLEARING SCRIPT
 * Очищает все данные из таблиц, но сохраняет структуру таблиц
 * Использует данные из .env файла
 */

const { Client } = require('pg');
require('dotenv').config();

const config = {
  host: process.env.DATABASE_HOST || 'prometric.cde42ec8m1u7.eu-north-1.rds.amazonaws.com',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  user: process.env.DATABASE_USERNAME || 'prometric',
  password: process.env.DATABASE_PASSWORD || 'prometric01',
  database: process.env.DATABASE_NAME || 'prometric_new',
  ssl: { rejectUnauthorized: false }
};

async function clearDatabaseData() {
  console.log('🗑️ Начинаем очистку данных из базы данных...\n');
  console.log(`📡 Подключаемся к: ${config.host}:${config.port}/${config.database}`);

  const client = new Client(config);

  try {
    await client.connect();
    console.log('✅ Успешно подключились к базе данных');

    // Получаем список всех таблиц
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables = tablesResult.rows.map(row => row.table_name);
    console.log(`📊 Найдено таблиц: ${tables.length}`);
    console.log('📋 Список таблиц:', tables.join(', '));

    if (tables.length === 0) {
      console.log('ℹ️ Таблицы не найдены. База данных пуста.');
      return;
    }

    // Отключаем проверки внешних ключей для безопасной очистки
    console.log('\n🔧 Отключаем проверки внешних ключей...');
    await client.query('SET session_replication_role = replica;');

    let clearedTables = 0;
    let totalRowsCleared = 0;

    // Очищаем каждую таблицу
    for (const tableName of tables) {
      try {
        // Получаем количество строк перед очисткой
        const countResult = await client.query(`SELECT COUNT(*) FROM "${tableName}"`);
        const rowCount = parseInt(countResult.rows[0].count);

        if (rowCount > 0) {
          // Очищаем таблицу
          await client.query(`DELETE FROM "${tableName}"`);
          console.log(`✅ Очищена таблица "${tableName}" (${rowCount} строк)`);
          clearedTables++;
          totalRowsCleared += rowCount;
        } else {
          console.log(`ℹ️ Таблица "${tableName}" уже пуста`);
        }
      } catch (error) {
        console.error(`❌ Ошибка при очистке таблицы "${tableName}":`, error.message);
      }
    }

    // Включаем обратно проверки внешних ключей
    console.log('\n🔧 Включаем проверки внешних ключей...');
    await client.query('SET session_replication_role = DEFAULT;');

    // Сбрасываем последовательности (auto-increment счетчики)
    console.log('\n🔄 Сбрасываем последовательности...');
    for (const tableName of tables) {
      try {
        // Проверяем есть ли последовательности для этой таблицы
        const sequencesResult = await client.query(`
          SELECT column_name, column_default
          FROM information_schema.columns
          WHERE table_name = $1
          AND column_default LIKE 'nextval%'
        `, [tableName]);

        if (sequencesResult.rows.length > 0) {
          // Сбрасываем последовательность
          await client.query(`ALTER SEQUENCE "${tableName}_id_seq" RESTART WITH 1`);
          console.log(`✅ Сброшена последовательность для "${tableName}"`);
        }
      } catch (error) {
        // Игнорируем ошибки для последовательностей (не все таблицы имеют их)
      }
    }

    console.log('\n📊 РЕЗУЛЬТАТЫ ОЧИСТКИ:');
    console.log(`✅ Очищено таблиц: ${clearedTables}`);
    console.log(`✅ Удалено строк: ${totalRowsCleared}`);
    console.log(`📋 Всего таблиц в базе: ${tables.length}`);

    console.log('\n🎉 Очистка данных завершена успешно!');
    console.log('ℹ️ Структура таблиц сохранена, данные удалены.');

  } catch (error) {
    console.error('❌ Ошибка при очистке базы данных:', error.message);
    console.error('🔍 Детали ошибки:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n📡 Соединение с базой данных закрыто');
  }
}

// Запускаем очистку
clearDatabaseData().catch(error => {
  console.error('💥 Критическая ошибка:', error);
  process.exit(1);
});