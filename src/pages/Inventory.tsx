import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Eye } from "lucide-react";
import { toast } from "sonner";
import { AddLotDialog } from "@/components/AddLotDialog";
import { LotDetailsDialog } from "@/components/LotDetailsDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Lot {
  id: string;
  lot_number: string;
  count: string;
  shade: string | null;
  cones: number;
  weight: number | null;
  price_per_kg: number | null;
  image_url: string | null;
  created_at: string;
}

export default function Inventory() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [filteredLots, setFilteredLots] = useState<Lot[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [quickSearchQuery, setQuickSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  useEffect(() => {
    fetchLots();

    const channel = supabase
      .channel("inventory-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lots",
        },
        () => fetchLots()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    filterLots();
  }, [searchQuery, lots]);

  const fetchLots = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("lots")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Error fetching inventory");
    } else {
      setLots(data || []);
    }
  };

  const filterLots = () => {
    if (!searchQuery.trim()) {
      setFilteredLots(lots);
    } else {
      const filtered = lots.filter((lot) =>
        lot.lot_number.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredLots(filtered);
    }
  };

  const handleQuickSearch = () => {
    const lot = lots.find(
      (l) => l.lot_number.toLowerCase() === quickSearchQuery.toLowerCase()
    );
    if (lot) {
      setSelectedLot(lot);
      setShowDetailsDialog(true);
    } else {
      toast.error("Lot number not found");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Inventory</h1>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add New Lot
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search lots..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Enter lot number..."
            value={quickSearchQuery}
            onChange={(e) => setQuickSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleQuickSearch()}
            className="w-full sm:w-64"
          />
          <Button onClick={handleQuickSearch} variant="secondary">
            <Eye className="mr-2 h-4 w-4" />
            Search
          </Button>
        </div>
      </div>

      {filteredLots.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            {searchQuery
              ? "No lots found matching your search"
              : "No lots in inventory yet. Add your first lot!"}
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lot Number</TableHead>
                <TableHead>Count</TableHead>
                <TableHead>Shade</TableHead>
                <TableHead>Cones</TableHead>
                <TableHead className="text-right">Weight (kg)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLots.map((lot) => {
                const weight = lot.weight != null ? Number(lot.weight) : 0;
                return (
                  <TableRow key={lot.id}>
                    <TableCell className="font-medium">{lot.lot_number}</TableCell>
                    <TableCell>{lot.count}</TableCell>
                    <TableCell>{lot.shade || "-"}</TableCell>
                    <TableCell>{lot.cones}</TableCell>
                    <TableCell className="text-right">{weight.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={weight < 10 ? "destructive" : "secondary"}>
                        {weight < 10 ? "Low Stock" : "In Stock"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedLot(lot);
                          setShowDetailsDialog(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AddLotDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
      {selectedLot && (
        <LotDetailsDialog
          lot={selectedLot}
          open={showDetailsDialog}
          onOpenChange={setShowDetailsDialog}
          onUpdate={fetchLots}
        />
      )}
    </div>
  );
}
