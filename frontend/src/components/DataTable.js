import React, { useState, useMemo } from 'react';

const DataTable = ({
  columns,
  data,
  onRowClick,
  onBulkDelete,
  searchableColumns = [],
  itemsPerPageOptions = [10, 25, 50, 100],
  defaultItemsPerPage = 10,
  exportFilename = 'export',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(defaultItemsPerPage);
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [filters, setFilters] = useState({});

  // Get unique values for filter dropdowns
  const filterOptions = useMemo(() => {
    const options = {};
    columns.forEach(col => {
      if (col.filterable) {
        const uniqueValues = [...new Set(data.map(row => row[col.key]).filter(Boolean))];
        options[col.key] = uniqueValues.sort();
      }
    });
    return options;
  }, [data, columns]);

  // Filter and search data
  const filteredData = useMemo(() => {
    let result = [...data];

    // Apply search
    if (searchTerm && searchableColumns.length > 0) {
      const term = searchTerm.toLowerCase();
      result = result.filter(row =>
        searchableColumns.some(col => {
          const value = row[col];
          return value && value.toString().toLowerCase().includes(term);
        })
      );
    }

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        result = result.filter(row => row[key] === value);
      }
    });

    // Apply sorting
    if (sortColumn) {
      result.sort((a, b) => {
        const aVal = a[sortColumn] ?? '';
        const bVal = b[sortColumn] ?? '';

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }

        const comparison = aVal.toString().localeCompare(bVal.toString());
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [data, searchTerm, searchableColumns, filters, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters, itemsPerPage]);

  const handleSort = (columnKey) => {
    if (sortColumn === columnKey) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedRows(new Set(paginatedData.map(row => row.id)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (id, e) => {
    e.stopPropagation();
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  };

  const handleBulkDelete = () => {
    if (selectedRows.size === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedRows.size} items?`)) {
      onBulkDelete([...selectedRows]);
      setSelectedRows(new Set());
    }
  };

  const exportToCSV = () => {
    const headers = columns.map(col => col.label).join(',');
    const rows = filteredData.map(row =>
      columns.map(col => {
        const value = col.render ? col.render(row) : row[col.key];
        // Escape quotes and wrap in quotes if contains comma
        const strValue = String(value ?? '').replace(/"/g, '""');
        return strValue.includes(',') ? `"${strValue}"` : strValue;
      }).join(',')
    );

    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportFilename}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const allSelected = paginatedData.length > 0 && paginatedData.every(row => selectedRows.has(row.id));

  return (
    <div className="data-table-wrapper">
      {/* Toolbar */}
      <div className="table-toolbar">
        <div className="toolbar-left">
          {searchableColumns.length > 0 && (
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          )}

          {/* Filter dropdowns */}
          {columns.filter(col => col.filterable).map(col => (
            <select
              key={col.key}
              value={filters[col.key] || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
              className="filter-select"
            >
              <option value="">All {col.label}</option>
              {filterOptions[col.key]?.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          ))}
        </div>

        <div className="toolbar-right">
          {selectedRows.size > 0 && onBulkDelete && (
            <button className="btn btn-danger btn-small" onClick={handleBulkDelete}>
              Delete ({selectedRows.size})
            </button>
          )}
          <button className="btn btn-secondary btn-small" onClick={exportToCSV}>
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              {onBulkDelete && (
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleSelectAll}
                  />
                </th>
              )}
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  style={{ cursor: col.sortable !== false ? 'pointer' : 'default' }}
                >
                  {col.label}
                  {sortColumn === col.key && (
                    <span className="sort-indicator">
                      {sortDirection === 'asc' ? ' ▲' : ' ▼'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (onBulkDelete ? 1 : 0)} style={{ textAlign: 'center', padding: '40px' }}>
                  No data found
                </td>
              </tr>
            ) : (
              paginatedData.map(row => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={selectedRows.has(row.id) ? 'selected' : ''}
                >
                  {onBulkDelete && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedRows.has(row.id)}
                        onChange={(e) => handleSelectRow(row.id, e)}
                      />
                    </td>
                  )}
                  {columns.map(col => (
                    <td key={col.key}>
                      {col.render ? col.render(row) : row[col.key] ?? '-'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="table-pagination">
        <div className="pagination-info">
          Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} items
        </div>

        <div className="pagination-controls">
          <select
            value={itemsPerPage}
            onChange={(e) => setItemsPerPage(Number(e.target.value))}
            className="items-per-page"
          >
            {itemsPerPageOptions.map(option => (
              <option key={option} value={option}>{option} per page</option>
            ))}
          </select>

          <button
            className="pagination-btn"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          >
            ««
          </button>
          <button
            className="pagination-btn"
            onClick={() => setCurrentPage(prev => prev - 1)}
            disabled={currentPage === 1}
          >
            «
          </button>

          <span className="page-info">
            Page {currentPage} of {totalPages || 1}
          </span>

          <button
            className="pagination-btn"
            onClick={() => setCurrentPage(prev => prev + 1)}
            disabled={currentPage >= totalPages}
          >
            »
          </button>
          <button
            className="pagination-btn"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage >= totalPages}
          >
            »»
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataTable;
