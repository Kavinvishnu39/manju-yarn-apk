import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface LowStockLot {
  id: string;
  lot_number: string;
  count: string;
  weight: number;
  price_per_kg: number;
}

export default function LowStock() {
  const [lowStockLots, setLowStockLots] = useState<LowStockLot[]>([]);

  useEffect(() => {
    fetchLowStockLots();

    const channel = supabase
      .channel("low-stock-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lots",
        },
        () => fetchLowStockLots()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLowStockLots = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("lots")
      .select("*")
      .eq("user_id", user.id)
      .lt("weight", 10)
      .order("weight", { ascending: true });

    if (error) {
      console.error("Error fetching low stock lots:", error);
      setLowStockLots([]);
      return;
    }

    const normalized = (data || []).map((lot: any) => ({
      ...lot,
      weight: Number(lot.weight),
      price_per_kg: Number(lot.price_per_kg ?? 0),
    }));

    setLowStockLots(normalized);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Low Stock</h1>

      <Alert variant={lowStockLots.length > 0 ? "destructive" : "default"}>
        {lowStockLots.length > 0 ? (
          <>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Low Stock Alert</AlertTitle>
            <AlertDescription>
              Lots with less than 10kg of yarn available
            </AlertDescription>
          </>
        ) : (
          <>
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>All Good!</AlertTitle>
            <AlertDescription>
              No low stock items at the moment. Your inventory levels are healthy!
            </AlertDescription>
          </>
        )}
      </Alert>

      {lowStockLots.length > 0 && (
        <>
          <p className="text-muted-foreground">
            These lots require immediate attention. Consider reordering or removing them from your
            inventory if they're no longer available.
          </p>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lot Number</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead className="text-right">Weight (kg)</TableHead>
                  <TableHead className="text-right">Price per kg</TableHead>
                  <TableHead className="text-right">Remaining Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStockLots.map((lot) => (
                  <TableRow key={lot.id}>
                    <TableCell className="font-medium">{lot.lot_number}</TableCell>
                    <TableCell>{lot.count}</TableCell>
                    <TableCell className="text-right">
                      <span className="font-semibold text-destructive">
                        {lot.weight.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">₹{lot.price_per_kg.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      ₹{(lot.weight * lot.price_per_kg).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
