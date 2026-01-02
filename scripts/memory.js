/**
 * Daily Do - Unified Memory Module
 * Manages localStorage with namespace support for all modules
 */

const Memory = (function() {
  // Storage key prefix
  const PREFIX = 'dailydo_';

  // Valid namespaces
  const NAMESPACES = ['finance', 'fitness', 'linkedin', 'meta'];

  /**
   * Validate namespace
   */
  function validateNamespace(namespace) {
    if (!NAMESPACES.includes(namespace)) {
      console.warn(`Memory: Unknown namespace "${namespace}". Valid: ${NAMESPACES.join(', ')}`);
    }
    return namespace;
  }

  /**
   * Get the full storage key
   */
  function getKey(namespace) {
    return PREFIX + validateNamespace(namespace);
  }

  /**
   * Get data from a namespace
   * @param {string} namespace - The namespace (finance, fitness, meta)
   * @param {string} [key] - Optional specific key within the namespace
   * @returns {*} The stored data or null
   */
  function get(namespace, key = null) {
    try {
      const stored = localStorage.getItem(getKey(namespace));
      if (!stored) return key ? null : {};

      const data = JSON.parse(stored);
      if (key) {
        return data[key] !== undefined ? data[key] : null;
      }
      return data;
    } catch (error) {
      console.error('Memory.get error:', error);
      return key ? null : {};
    }
  }

  /**
   * Set data in a namespace
   * @param {string} namespace - The namespace
   * @param {string} key - The key to set
   * @param {*} value - The value to store
   */
  function set(namespace, key, value) {
    try {
      const data = get(namespace);
      data[key] = value;
      data._lastUpdated = new Date().toISOString();
      localStorage.setItem(getKey(namespace), JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Memory.set error:', error);
      return false;
    }
  }

  /**
   * Remove a key from a namespace
   * @param {string} namespace - The namespace
   * @param {string} key - The key to remove
   */
  function remove(namespace, key) {
    try {
      const data = get(namespace);
      delete data[key];
      data._lastUpdated = new Date().toISOString();
      localStorage.setItem(getKey(namespace), JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Memory.remove error:', error);
      return false;
    }
  }

  /**
   * Get all data from a namespace
   * @param {string} namespace - The namespace
   * @returns {Object} All data in the namespace
   */
  function getAll(namespace) {
    return get(namespace);
  }

  /**
   * Clear all data in a namespace
   * @param {string} namespace - The namespace to clear
   */
  function clear(namespace) {
    try {
      localStorage.removeItem(getKey(namespace));
      return true;
    } catch (error) {
      console.error('Memory.clear error:', error);
      return false;
    }
  }

  /**
   * Export all data as JSON
   * @returns {Object} All stored data
   */
  function exportAll() {
    const data = {};
    NAMESPACES.forEach(ns => {
      data[ns] = get(ns);
    });
    data._exportedAt = new Date().toISOString();
    return data;
  }

  /**
   * Import data from JSON
   * @param {Object} data - Data to import
   * @param {boolean} merge - If true, merge with existing data. If false, replace.
   */
  function importData(data, merge = true) {
    try {
      NAMESPACES.forEach(ns => {
        if (data[ns]) {
          if (merge) {
            const existing = get(ns);
            const merged = { ...existing, ...data[ns] };
            localStorage.setItem(getKey(ns), JSON.stringify(merged));
          } else {
            localStorage.setItem(getKey(ns), JSON.stringify(data[ns]));
          }
        }
      });
      return true;
    } catch (error) {
      console.error('Memory.import error:', error);
      return false;
    }
  }

  /**
   * Download data as JSON file
   */
  function downloadBackup() {
    const data = exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dailydo-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Restore from JSON file
   * @param {File} file - The file to restore from
   * @returns {Promise<boolean>}
   */
  function restoreFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          importData(data, false);
          resolve(true);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  // ========================================
  // Meta helpers
  // ========================================

  /**
   * Track last visited module
   */
  function setLastVisited(module) {
    set('meta', 'lastVisited', module);
  }

  function getLastVisited() {
    return get('meta', 'lastVisited');
  }

  /**
   * Get storage usage info
   */
  function getStorageInfo() {
    let totalSize = 0;
    const breakdown = {};

    NAMESPACES.forEach(ns => {
      const key = getKey(ns);
      const data = localStorage.getItem(key);
      const size = data ? new Blob([data]).size : 0;
      breakdown[ns] = size;
      totalSize += size;
    });

    return {
      total: totalSize,
      totalFormatted: formatBytes(totalSize),
      breakdown,
      breakdownFormatted: Object.fromEntries(
        Object.entries(breakdown).map(([k, v]) => [k, formatBytes(v)])
      )
    };
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // ========================================
  // Migration helpers (for existing data)
  // ========================================

  /**
   * Migrate old fitness localStorage data to new format
   */
  function migrateFitnessData() {
    // Check for old keys
    const oldKeys = ['fitnessPlanned', 'fitnessCompleted', 'workoutLog'];
    let migrated = false;

    oldKeys.forEach(oldKey => {
      const oldData = localStorage.getItem(oldKey);
      if (oldData) {
        try {
          const parsed = JSON.parse(oldData);
          const newKey = oldKey.replace('fitness', '').toLowerCase();
          set('fitness', newKey || oldKey, parsed);
          localStorage.removeItem(oldKey);
          migrated = true;
          console.log(`Memory: Migrated ${oldKey} to fitness namespace`);
        } catch (e) {
          console.warn(`Memory: Could not migrate ${oldKey}`, e);
        }
      }
    });

    // Also check for any key starting with 'planned_' or 'completed_'
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('planned_') || key.startsWith('completed_'))) {
        try {
          const data = localStorage.getItem(key);
          const parsed = JSON.parse(data);
          set('fitness', key, parsed);
          localStorage.removeItem(key);
          migrated = true;
          console.log(`Memory: Migrated ${key} to fitness namespace`);
        } catch (e) {
          // Skip non-JSON data
        }
      }
    }

    return migrated;
  }

  // Run migration on load
  if (typeof window !== 'undefined') {
    migrateFitnessData();
  }

  // Public API
  return {
    get,
    set,
    remove,
    getAll,
    clear,
    export: exportAll,
    import: importData,
    downloadBackup,
    restoreFromFile,
    setLastVisited,
    getLastVisited,
    getStorageInfo,
    migrate: {
      fitness: migrateFitnessData
    },
    NAMESPACES
  };
})();

// Export for ES modules if available
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Memory;
}
