import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Search, Pencil, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { z } from "zod";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ADMIN_PIN = "1233";

interface Lot {
  id: string;
  lot_number: string;
  count: string;
  weight: number;
  price_per_kg: number;
}

interface Sale {
  id: string;
  lot_id: string | null;
  lot_number: string;
  count: string;
  customer_name: string;
  bill_number: string;
  weight_sold: number;
  price_per_kg: number;
  total_amount: number;
  created_at: string;
  sale_date: string;
}

const saleSchema = z.object({
  customerName: z.string().trim().min(1, "Customer name required").max(100, "Name too long"),
  billNumber: z.string().trim().min(1, "Bill number required").max(50, "Bill number too long").regex(/^[A-Z0-9-]+$/i, "Invalid bill number format"),
  weightSold: z.number().positive("Weight must be positive").max(10000, "Weight unrealistic"),
  pricePerKg: z.number().positive("Price must be positive").max(100000, "Price unrealistic")
});

export default function Sales() {
  const [lotNumber, setLotNumber] = useState("");
  const [searchedLot, setSearchedLot] = useState<Lot | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [weightSold, setWeightSold] = useState("");
  const [pricePerKg, setPricePerKg] = useState("");
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [fromInventory, setFromInventory] = useState(true);
  const [manualCount, setManualCount] = useState("");

  // Edit/Delete state
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const [pendingAction, setPendingAction] = useState<{ type: "edit" | "delete"; sale: Sale } | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editBillNumber, setEditBillNumber] = useState("");
  const [editWeightSold, setEditWeightSold] = useState("");
  const [editPricePerKg, setEditPricePerKg] = useState("");

  useEffect(() => {
    fetchRecentSales();

    const channel = supabase
      .channel("sales-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales",
        },
        () => fetchRecentSales()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRecentSales = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("sales")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    setRecentSales(data || []);
  };

  const handleSearchLot = async () => {
    if (!lotNumber.trim()) {
      toast.error("Please enter a lot number");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("lots")
      .select("*")
      .eq("user_id", user.id)
      .eq("lot_number", lotNumber.toUpperCase())
      .single();

    if (error || !data) {
      toast.error("Lot not found");
      setSearchedLot(null);
    } else {
      setSearchedLot(data);
      toast.success(`Found lot ${data.lot_number} - ${data.weight.toFixed(2)} kg available`);
    }
  };

  const handleRecordSale = async (e: React.FormEvent) => {
    e.preventDefault();

    if (fromInventory && !searchedLot) {
      toast.error("Please search for a lot first");
      return;
    }

    if (!fromInventory && (!lotNumber.trim() || !manualCount.trim())) {
      toast.error("Please enter lot number and count");
      return;
    }

    const weightSoldNum = parseFloat(weightSold);
    const pricePerKgNum = parseFloat(pricePerKg);

    // Validate inputs
    const validation = saleSchema.safeParse({
      customerName,
      billNumber,
      weightSold: weightSoldNum,
      pricePerKg: pricePerKgNum
    });

    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError.message);
      return;
    }

    if (fromInventory && searchedLot && weightSoldNum > searchedLot.weight) {
      toast.error(`Cannot sell more than available weight (${searchedLot.weight.toFixed(2)} kg)`);
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const totalAmount = weightSoldNum * pricePerKgNum;

      const saleData: any = {
        user_id: user.id,
        lot_number: fromInventory ? searchedLot!.lot_number : lotNumber.toUpperCase(),
        count: fromInventory ? searchedLot!.count : manualCount,
        customer_name: validation.data.customerName,
        bill_number: validation.data.billNumber,
        weight_sold: validation.data.weightSold,
        price_per_kg: validation.data.pricePerKg,
        total_amount: totalAmount,
        sale_date: new Date().toISOString().split("T")[0],
      };

      if (fromInventory && searchedLot) {
        saleData.lot_id = searchedLot.id;
      }

      const { error: saleError } = await supabase.from("sales").insert(saleData);

      if (saleError) throw saleError;

      if (fromInventory && searchedLot) {
        const newWeight = searchedLot.weight - weightSoldNum;
        const { error: updateError } = await supabase
          .from("lots")
          .update({ weight: newWeight })
          .eq("id", searchedLot.id);

        if (updateError) throw updateError;

        toast.success(
          `Sale recorded! ₹${Math.round(totalAmount)} - Remaining weight: ${newWeight.toFixed(2)} kg`
        );
      } else {
        toast.success(`Sale recorded! ₹${Math.round(totalAmount)} (Out of inventory)`);
      }

      setLotNumber("");
      setSearchedLot(null);
      setCustomerName("");
      setBillNumber("");
      setWeightSold("");
      setPricePerKg("");
      setManualCount("");
    } catch (error: any) {
      toast.error(error.message || "Error recording sale");
    } finally {
      setLoading(false);
    }
  };

  const handleActionRequest = (type: "edit" | "delete", sale: Sale) => {
    setPendingAction({ type, sale });
    setEnteredPin("");
    setPinDialogOpen(true);
  };

  const handlePinSubmit = () => {
    if (enteredPin !== ADMIN_PIN) {
      toast.error("Incorrect PIN");
      setEnteredPin("");
      return;
    }

    setPinDialogOpen(false);
    setEnteredPin("");

    if (pendingAction?.type === "delete") {
      handleDeleteSale(pendingAction.sale);
    } else if (pendingAction?.type === "edit") {
      openEditDialog(pendingAction.sale);
    }
    setPendingAction(null);
  };

  const openEditDialog = (sale: Sale) => {
    setEditingSale(sale);
    setEditCustomerName(sale.customer_name);
    setEditBillNumber(sale.bill_number);
    setEditWeightSold(String(sale.weight_sold));
    setEditPricePerKg(String(sale.price_per_kg));
    setEditDialogOpen(true);
  };

  const handleDeleteSale = async (sale: Sale) => {
    try {
      const { error } = await supabase.from("sales").delete().eq("id", sale.id);
      if (error) throw error;

      // Restore weight to lot if it was from inventory
      if (sale.lot_id) {
        const { data: lot } = await supabase
          .from("lots")
          .select("weight")
          .eq("id", sale.lot_id)
          .maybeSingle();

        if (lot) {
          await supabase
            .from("lots")
            .update({ weight: Number(lot.weight) + Number(sale.weight_sold) })
            .eq("id", sale.lot_id);
        }
      }

      toast.success("Sale deleted successfully");
    } catch (error: any) {
      toast.error(error.message || "Error deleting sale");
    }
  };

  const handleUpdateSale = async () => {
    if (!editingSale) return;

    const weightSoldNum = parseFloat(editWeightSold);
    const pricePerKgNum = parseFloat(editPricePerKg);

    const validation = saleSchema.safeParse({
      customerName: editCustomerName,
      billNumber: editBillNumber,
      weightSold: weightSoldNum,
      pricePerKg: pricePerKgNum
    });

    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    const weightDifference = weightSoldNum - Number(editingSale.weight_sold);
    const newTotalAmount = weightSoldNum * pricePerKgNum;

    try {
      // If from inventory, check and update lot weight
      if (editingSale.lot_id && weightDifference !== 0) {
        const { data: lot } = await supabase
          .from("lots")
          .select("weight")
          .eq("id", editingSale.lot_id)
          .maybeSingle();

        if (lot) {
          const newLotWeight = Number(lot.weight) - weightDifference;
          if (newLotWeight < 0) {
            toast.error(`Cannot update: only ${Number(lot.weight).toFixed(2)} kg available in lot`);
            return;
          }
          await supabase
            .from("lots")
            .update({ weight: newLotWeight })
            .eq("id", editingSale.lot_id);
        }
      }

      const { error } = await supabase
        .from("sales")
        .update({
          customer_name: validation.data.customerName,
          bill_number: validation.data.billNumber,
          weight_sold: validation.data.weightSold,
          price_per_kg: validation.data.pricePerKg,
          total_amount: newTotalAmount,
        })
        .eq("id", editingSale.id);

      if (error) throw error;

      toast.success("Sale updated successfully");
      setEditDialogOpen(false);
      setEditingSale(null);
    } catch (error: any) {
      toast.error(error.message || "Error updating sale");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Record Sale</h1>

        <Card>
          <CardHeader>
            <CardTitle>New Sale</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRecordSale} className="space-y-4">
              <div className="flex items-center space-x-2 mb-4">
                <Checkbox 
                  id="from_inventory" 
                  checked={fromInventory}
                  onCheckedChange={(checked) => {
                    setFromInventory(checked as boolean);
                    setLotNumber("");
                    setSearchedLot(null);
                    setManualCount("");
                  }}
                />
                <Label htmlFor="from_inventory" className="cursor-pointer">
                  From Inventory
                </Label>
              </div>

              {fromInventory ? (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="lot_number">Lot Number</Label>
                    <Input
                      id="lot_number"
                      placeholder="MS-3712"
                      value={lotNumber}
                      onChange={(e) => setLotNumber(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSearchLot())}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" onClick={handleSearchLot}>
                      <Search className="mr-2 h-4 w-4" />
                      Search
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="manual_lot_number">Lot Number *</Label>
                    <Input
                      id="manual_lot_number"
                      placeholder="MS-3712"
                      value={lotNumber}
                      onChange={(e) => setLotNumber(e.target.value.toUpperCase())}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manual_count">Count *</Label>
                    <Input
                      id="manual_count"
                      placeholder="2/24"
                      value={manualCount}
                      onChange={(e) => setManualCount(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              {fromInventory && searchedLot && (
                <div className="rounded-lg border bg-accent p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Lot:</span>
                      <span className="ml-2 font-semibold">{searchedLot.lot_number}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Count:</span>
                      <span className="ml-2 font-semibold">{searchedLot.count}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Available:</span>
                      <span className="ml-2 font-semibold">{searchedLot.weight.toFixed(2)} kg</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="customer_name">Customer Name *</Label>
                <Input
                  id="customer_name"
                  placeholder="Enter customer name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bill_number">Bill Number *</Label>
                <Input
                  id="bill_number"
                  placeholder="Enter bill number"
                  value={billNumber}
                  onChange={(e) => setBillNumber(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight_sold">Weight Sold (kg) *</Label>
                <Input
                  id="weight_sold"
                  type="number"
                  step="0.01"
                  placeholder="25.00"
                  value={weightSold}
                  onChange={(e) => setWeightSold(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price_per_kg">Price per kg (₹) *</Label>
                <Input
                  id="price_per_kg"
                  type="number"
                  step="0.01"
                  placeholder="525.00"
                  value={pricePerKg}
                  onChange={(e) => setPricePerKg(e.target.value)}
                  required
                />
              </div>

              {weightSold && pricePerKg && (
                <div className="rounded-lg border bg-success/10 border-success p-4">
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold text-success">
                    ₹{Math.round(parseFloat(weightSold) * parseFloat(pricePerKg))}
                  </p>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                disabled={(fromInventory && !searchedLot) || loading}
              >
                {loading ? "Recording..." : "Record Sale"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div>
        <Card>
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
          </CardHeader>
          <CardContent>
            {recentSales.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No recent sales</p>
            ) : (
              <div className="space-y-3">
                {recentSales.map((sale) => (
                  <div key={sale.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-semibold">{sale.lot_number}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleActionRequest("edit", sale)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => handleActionRequest("delete", sale)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mb-1">
                      {new Date(sale.created_at).toLocaleDateString()}
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div>{sale.customer_name}</div>
                      <div>Bill: {sale.bill_number}</div>
                      <div>{Number(sale.weight_sold).toFixed(2)} kg × ₹{Number(sale.price_per_kg).toFixed(2)}</div>
                      <div className="font-semibold text-foreground">₹{Math.round(Number(sale.total_amount))}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* PIN Dialog */}
      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter PIN</DialogTitle>
            <DialogDescription>
              Enter the admin PIN to {pendingAction?.type} this sale.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="password"
              placeholder="Enter PIN"
              value={enteredPin}
              onChange={(e) => setEnteredPin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePinSubmit()}
              maxLength={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePinSubmit}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sale</DialogTitle>
            <DialogDescription>
              Update the sale details for {editingSale?.lot_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Customer Name</Label>
              <Input
                value={editCustomerName}
                onChange={(e) => setEditCustomerName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Bill Number</Label>
              <Input
                value={editBillNumber}
                onChange={(e) => setEditBillNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Weight Sold (kg)</Label>
              <Input
                type="number"
                step="0.01"
                value={editWeightSold}
                onChange={(e) => setEditWeightSold(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Price per kg (₹)</Label>
              <Input
                type="number"
                step="0.01"
                value={editPricePerKg}
                onChange={(e) => setEditPricePerKg(e.target.value)}
              />
            </div>
            {editWeightSold && editPricePerKg && (
              <div className="rounded-lg border bg-success/10 border-success p-3">
                <p className="text-sm text-muted-foreground">New Total</p>
                <p className="text-xl font-bold text-success">
                  ₹{Math.round(parseFloat(editWeightSold) * parseFloat(editPricePerKg))}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateSale}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
