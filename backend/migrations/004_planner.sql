CREATE TABLE IF NOT EXISTS planner_tasks (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id INT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  progress TINYINT UNSIGNED NOT NULL DEFAULT 0,
  color VARCHAR(7) DEFAULT NULL,
  assignee_id INT UNSIGNED DEFAULT NULL,
  visibility ENUM('internal','client') NOT NULL DEFAULT 'internal',
  position INT UNSIGNED NOT NULL DEFAULT 0,
  created_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_planner_project (project_id),
  CONSTRAINT fk_planner_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_planner_assignee FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_planner_creator FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS planner_deps (
  task_id INT UNSIGNED NOT NULL,
  depends_on INT UNSIGNED NOT NULL,
  PRIMARY KEY (task_id, depends_on),
  CONSTRAINT fk_dep_task FOREIGN KEY (task_id) REFERENCES planner_tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_dep_on FOREIGN KEY (depends_on) REFERENCES planner_tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
