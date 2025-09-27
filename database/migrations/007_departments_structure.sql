-- Departments Structure Migration
-- Добавляем departments и обновляем user roles

-- Создаем таблицу departments
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    organization_id UUID NOT NULL,
    department_type VARCHAR(20) NOT NULL CHECK (department_type IN ('sales', 'marketing', 'support')),
    manager_id UUID, -- Ссылка на пользователя который управляет департаментом
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Constraints
    UNIQUE(organization_id, name), -- Уникальное имя в рамках организации
    UNIQUE(organization_id, department_type) -- Один департамент каждого типа на организацию
);

-- Добавляем department_id в user_roles table
ALTER TABLE user_roles
ADD COLUMN department_id UUID REFERENCES departments(id);

-- Создаем индексы для производительности
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_departments_organization ON departments(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_departments_manager ON departments(manager_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_departments_type ON departments(department_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_roles_department ON user_roles(department_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_roles_org_dept ON user_roles(organization_id, department_id);

-- Добавляем department_id во все business tables для data isolation

-- Customers belong to departments
ALTER TABLE customers
ADD COLUMN department_id UUID REFERENCES departments(id);

-- Deals belong to departments
ALTER TABLE deals
ADD COLUMN department_id UUID REFERENCES departments(id);

-- Knowledge documents can be department-specific
ALTER TABLE knowledge_documents
ADD COLUMN department_id UUID REFERENCES departments(id);

-- Activities belong to departments
ALTER TABLE activities
ADD COLUMN department_id UUID REFERENCES departments(id);

-- Создаем индексы для department isolation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_department ON customers(department_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_department ON deals(department_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_documents_department ON knowledge_documents(department_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_department ON activities(department_id);

-- Composite indexes для быстрой фильтрации по organization + department
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_org_dept ON customers(organization_id, department_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_org_dept ON deals(organization_id, department_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_documents_org_dept ON knowledge_documents(organization_id, department_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_org_dept ON activities(organization_id, department_id);