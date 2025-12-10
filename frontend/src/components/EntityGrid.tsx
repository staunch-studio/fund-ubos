import { useState, useMemo } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table"
import type { EntityInstance } from "../types/ubos"
import { Checkbox } from "./ui/checkbox"
import { Button } from "./ui/button"
import { GitCommit, GitMerge, FileDiff } from "lucide-react"

interface EntityGridProps {
  data: EntityInstance[]
  onRowSelect: (entity: EntityInstance | null) => void
  selectedEntity: EntityInstance | null
}

export function EntityGrid({ data, onRowSelect, selectedEntity }: EntityGridProps) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [globalFilter, setGlobalFilter] = useState("")

  const columns = useMemo<ColumnDef<EntityInstance>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onChange={(e) => row.toggleSelected(e.target.checked)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "id",
        header: "ID",
        cell: (info) => (
          <span className="font-mono text-xs">{info.getValue() as string}</span>
        ),
      },
      {
        accessorKey: "slug",
        header: "Slug",
        cell: (info) => (
          <span className="font-medium">{info.getValue() as string}</span>
        ),
      },
      {
        accessorKey: "entityType",
        header: "Type",
        cell: (info) => (
          <span className="px-2 py-1 bg-secondary rounded text-xs">
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "branch",
        header: "Branch",
        cell: (info) => (
          <span className="px-2 py-1 bg-muted rounded text-xs">
            {info.getValue() as string}
          </span>
        ),
      },
    ],
    []
  )

  const table = useReactTable({
    data,
    columns,
    state: {
      rowSelection,
      globalFilter,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const selectedRows = useMemo(() => {
    return table
      .getSelectedRowModel()
      .rows.map((row) => row.original)
  }, [rowSelection, data])

  const hasSelection = selectedRows.length > 0

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="border-b border-border p-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search entities..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-9 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        {hasSelection && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedRows.length} selected
            </span>
            <Button size="sm" variant="outline">
              <GitCommit className="h-4 w-4 mr-2" />
              Batch Commit
            </Button>
            <Button size="sm" variant="outline">
              <FileDiff className="h-4 w-4 mr-2" />
              Diff Selected
            </Button>
            <Button size="sm" variant="outline">
              <GitMerge className="h-4 w-4 mr-2" />
              Merge
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-card border-b border-border">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-background divide-y divide-border">
            {table.getRowModel().rows.map((row) => {
              const isSelected = selectedEntity?.id === row.original.id
              return (
                <tr
                  key={row.id}
                  onClick={() => onRowSelect(row.original)}
                  className={`
                    cursor-pointer transition-colors
                    ${isSelected ? "bg-primary/10" : "hover:bg-accent"}
                  `}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-sm">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
        {table.getRowModel().rows.length === 0 && (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No entities found
          </div>
        )}
      </div>
    </div>
  )
}

