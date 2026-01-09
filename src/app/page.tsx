"use client";

import {
  Upload,
  Send,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  File,
  RotateCw,
  Search,
  Cloud,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "../../lib/supabaseClient";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";

const AUTO_EXCLUDED_KEYS = ["id", "created_at", "updated_at", "raw_enrichment"];

export default function LeadManagementPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  const [uploadState, setUploadState] = useState({
    file: null as File | null,
    isUploading: false,
    success: "",
    error: "",
  });

  const [tableState, setTableState] = useState({
    data: [] as any[],
    isLoading: true,
    error: "",
    searchTerm: "",
  });

  const [filters, setFilters] = useState({
    recentlyFunded: "all",
    outreachStatus: "all",
    fundingRound: "all",
    scoreRange: "all",
  });

  /* ================= FETCH DATA ================= */
  const fetchData = useCallback(async () => {
    setTableState((p) => ({ ...p, isLoading: true, error: "" }));
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setTableState((p) => ({
        ...p,
        data: data ?? [],
        isLoading: false,
      }));
    } catch {
      setTableState((p) => ({
        ...p,
        isLoading: false,
        error: "Failed to load records",
      }));
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ================= OPTIONS ================= */
  const outreachOptions = useMemo(() => {
    const set = new Set<string>();
    tableState.data.forEach((d) => d.outreach_status && set.add(d.outreach_status));
    return Array.from(set);
  }, [tableState.data]);

  const fundingRoundOptions = useMemo(() => {
    const set = new Set<string>();
    tableState.data.forEach((d) => d.funding_round && set.add(d.funding_round));
    return Array.from(set);
  }, [tableState.data]);

  /* ================= COLUMNS ================= */
  const columns = useMemo(() => {
    if (tableState.data.length === 0) return [];
    const keys = Object.keys(tableState.data[0]).filter(
      (k) => !AUTO_EXCLUDED_KEYS.includes(k)
    );

    return [
      { key: "__sno", label: "S.No" },
      ...keys.map((k) => ({
        key: k,
        label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      })),
    ];
  }, [tableState.data]);

  /* ================= FILTERED DATA ================= */
  const filteredData = useMemo(() => {
    return tableState.data.filter((row) => {
      const search = tableState.searchTerm.toLowerCase();

      const matchesSearch =
        row.company_name?.toLowerCase().includes(search) ||
        row.website_url?.toLowerCase().includes(search) ||
        row.funding_round?.toLowerCase().includes(search);

      const matchesRecentlyFunded =
        filters.recentlyFunded === "all" ||
        (filters.recentlyFunded === "yes" && row.recently_raised === true) ||
        (filters.recentlyFunded === "no" && row.recently_raised === false);

      const matchesOutreach =
        filters.outreachStatus === "all" ||
        row.outreach_status === filters.outreachStatus;

      const matchesFundingRound =
        filters.fundingRound === "all" ||
        row.funding_round === filters.fundingRound;

      const score = Number(row.score || 0);
      const matchesScore =
        filters.scoreRange === "all" ||
        (filters.scoreRange === "high" && score >= 8) ||
        (filters.scoreRange === "medium" && score >= 5 && score <= 7) ||
        (filters.scoreRange === "low" && score > 0 && score <= 4);

      return (
        matchesSearch &&
        matchesRecentlyFunded &&
        matchesOutreach &&
        matchesFundingRound &&
        matchesScore
      );
    });
  }, [tableState.data, tableState.searchTerm, filters]);

  const indexOfLast = currentPage * rowsPerPage;
  const indexOfFirst = indexOfLast - rowsPerPage;
  const currentRows = filteredData.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);

  const handleUpload = async () => {
    console.log(uploadState, "===click")
    if (!uploadState.file) return;

    setUploadState((p) => ({
      ...p,
      isUploading: true,
      error: "",
      success: "",
    }));

    const excelSerialToISO = (serial: number) => {
      const utcDays = serial - 25569;
      const utcValue = utcDays * 86400;
      return new Date(utcValue * 1000).toISOString();
    };
    const normalizeNumber = (value: any): number | null => {
      if (value === null || value === undefined) return null;

      // If already a number
      if (typeof value === "number") return value;

      if (typeof value !== "string") return null;

      const cleaned = value
        .toLowerCase()
        .replace(/[, ]/g, "")       // remove commas & spaces
        .replace(/[^0-9.kmb-]/g, ""); // keep numbers + k/m/b

      let multiplier = 1;

      if (cleaned.endsWith("k")) multiplier = 1_000;
      if (cleaned.endsWith("m")) multiplier = 1_000_000;
      if (cleaned.endsWith("b")) multiplier = 1_000_000_000;

      const numericPart = parseFloat(cleaned.replace(/[kmb]/g, ""));

      if (isNaN(numericPart)) return null;

      return numericPart * multiplier;
    };


    try {
      const buffer = await uploadState.file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows: any[] = XLSX.utils.sheet_to_json(sheet);

      if (!rawRows.length) {
        throw new Error("Excel file is empty");
      }

      const mappedRows = rawRows.map((row) => {
        return ({
          company_name: row["identifier-label"] || "",
          website_url: row["component--field-formatter href"] || "",
          funding_date: row["component--field-formatter (4)"] ? excelSerialToISO(row["component--field-formatter (4)"]) : "",
          funding_amount: row["component--field-formatter (6)"] ? normalizeNumber(row["component--field-formatter (6)"]) : "",
          funding_round: row["component--field-formatter (5)"] || "",
          location: row["component--field-formatter (8)"] || "",
          category: row["accent (3)"] || "",
          industry_tags: row["component--field-formatter (7)"]?.split(", ") || []
        })
      });

      /* 4️⃣ Chunked insert to Supabase */
      const CHUNK_SIZE = 50;

      for (let i = 0; i < mappedRows.length; i += CHUNK_SIZE) {
        const chunk = mappedRows.slice(i, i + CHUNK_SIZE);

        const { error } = await supabase.from("leads").insert(chunk);
        if (error) throw error;
      }

      await fetch(process.env.NEXT_PUBLIC_WEBHOOK_URL as string,);

      setUploadState({
        file: null,
        isUploading: false,
        error: "",
        success: `Uploaded ${mappedRows.length} leads & triggered workflow`,
      });

      fetchData();
    } catch (err: any) {
      setUploadState((p) => ({
        ...p,
        isUploading: false,
        error: err.message || "Upload failed",
      }));
    }
  };


  const renderCell = (value: any, colKey: string, index: number) => {
    if (colKey === "__sno") return index;

    if (typeof value === "object" && value !== null) {
      return (
        <div className="text-xs text-gray-600 space-y-0.5">
          {Object.entries(value).map(([k, v]) => (
            <div key={k}>
              <span className="font-medium">{k}:</span>{" "}
              <span>{String(v)}</span>
            </div>
          ))}
        </div>
      );
    }

    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }

    if (typeof value === "string" && value.startsWith("http")) {
      return (
        <a
          href={value}
          target="_blank"
          className="text-blue-600 hover:underline"
        >
          Link
        </a>
      );
    }

    return value ?? "-";
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-blue-50 p-6 text-gray-600">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="bg-white/80 backdrop-blur border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-gray-900">
            Lead Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload Excel leads, filter and manage outreach-ready companies
          </p>
        </div>

        {/* ACTION BAR */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 shadow"
            >
              <Upload className="h-4 w-4" />
              Upload Excel
            </button>

            {uploadState.file && (
              <button
                onClick={handleUpload}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm border bg-white hover:bg-gray-50 shadow-sm"
              >
                {uploadState.isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Confirm Upload
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white shadow-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                placeholder="Search leads..."
                value={tableState.searchTerm}
                onChange={(e) =>
                  setTableState((p) => ({ ...p, searchTerm: e.target.value }))
                }
              />
            </div>

            <button
              onClick={fetchData}
              className="p-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 shadow-sm"
            >
              <RotateCw className="h-4 w-4 text-gray-600" />
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept=".xlsx,.xls"
            onChange={(e) =>
              setUploadState({
                ...uploadState,
                file: e.target.files?.[0] || null,
                success: "",
                error: "",
              })
            }
          />
        </div>

        {/* FILTERS */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Filters
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <select
              className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm"
              value={filters.recentlyFunded}
              onChange={(e) =>
                setFilters((p) => ({ ...p, recentlyFunded: e.target.value }))
              }
            >
              <option value="all">Recently Funded (All)</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>

            <select
              className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm"
              value={filters.scoreRange}
              onChange={(e) =>
                setFilters((p) => ({ ...p, scoreRange: e.target.value }))
              }
            >
              <option value="all">Score (All)</option>
              <option value="high">High (8–10)</option>
              <option value="medium">Medium (5–7)</option>
              <option value="low">Low (1–4)</option>
            </select>

            <select
              className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm"
              value={filters.outreachStatus}
              onChange={(e) =>
                setFilters((p) => ({ ...p, outreachStatus: e.target.value }))
              }
            >
              <option value="all">Outreach Status</option>
              {outreachOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>

            <select
              className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm"
              value={filters.fundingRound}
              onChange={(e) =>
                setFilters((p) => ({ ...p, fundingRound: e.target.value }))
              }
            >
              <option value="all">Funding Round</option>
              {fundingRoundOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>

            <button
              onClick={() =>
                setFilters({
                  recentlyFunded: "all",
                  outreachStatus: "all",
                  fundingRound: "all",
                  scoreRange: "all",
                })
              }
              className="border rounded-lg px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 shadow-sm"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div
            ref={tableContainerRef}
            className="overflow-auto"
            style={{ maxHeight: 600 }}
          >
            <table className="w-full border-separate border-spacing-0">
              {/* HEADER */}
              <thead className="sticky top-0 z-10 bg-gray-100 shadow-sm">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase text-left border-b"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* BODY */}
              <tbody>
                {currentRows.map((row, i) => (
                  <tr key={row.id} className="hover:bg-blue-50/40">
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className="px-4 py-2 text-sm text-gray-800"
                      >
                        {renderCell(
                          col.key === "__sno"
                            ? indexOfFirst + i + 1
                            : row[col.key],
                          col.key,
                          indexOfFirst + i + 1
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-between items-center px-4 py-3 text-sm text-gray-600 bg-gray-50 border-t">
              <span>
                Showing {indexOfFirst + 1} –{" "}
                {Math.min(indexOfLast, filteredData.length)} of{" "}
                {filteredData.length}
              </span>

              <div className="flex gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="px-3 py-1 border rounded-lg bg-white shadow-sm disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="px-3 py-1 border rounded-lg bg-white shadow-sm disabled:opacity-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>


        <div className="flex justify-center text-xs text-gray-500">
          <Cloud className="h-3 w-3 mr-1" />
          Connected to Supabase
        </div>
      </div>
    </div>
  );
}
