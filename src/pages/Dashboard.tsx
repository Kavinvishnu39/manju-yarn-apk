import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, ShoppingCart, Scale, Box as BoxIcon, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface SaleRecord {
  id: string;
  lot_number: string;
  count: string;
  customer_name: string;
  bill_number: string;
  weight_sold: number;
  price_per_kg: number;
  total_amount: number;
  sale_date: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalInventory: 0,
    totalLots: 0,
    todaySales: 0,
    todayRevenue: 0,
    lowStockItems: 0,
  });
  const [lastUpdated, setLastUpdated] = useState("");
  const [searchLotNumber, setSearchLotNumber] = useState("");
  const [searchResults, setSearchResults] = useState<SaleRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(() => {
      setLastUpdated(new Date().toLocaleString());
    }, 1000);

    const channel = supabase
      .channel("dashboard-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lots",
        },
        () => fetchStats()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales",
        },
        () => fetchStats()
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: lots } = await supabase
      .from("lots")
      .select("weight")
      .eq("user_id", user.id);

    const { data: lowStock } = await supabase
      .from("lots")
      .select("id")
      .eq("user_id", user.id)
      .lt("weight", 10);

    const today = new Date().toISOString().split("T")[0];
    const { data: todaySalesData } = await supabase
      .from("sales")
      .select("weight_sold, total_amount")
      .eq("user_id", user.id)
      .eq("sale_date", today);

    const totalInventory = lots?.reduce((sum, lot) => sum + Number(lot.weight), 0) || 0;
    const todaySalesWeight = todaySalesData?.reduce((sum, sale) => sum + Number(sale.weight_sold), 0) || 0;
    const todayRevenue = todaySalesData?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0;

    setStats({
      totalInventory,
      totalLots: lots?.length || 0,
      todaySales: todaySalesWeight,
      todayRevenue,
      lowStockItems: lowStock?.length || 0,
    });

    setLastUpdated(new Date().toLocaleString());
  };

  const handleSearch = async () => {
    if (!searchLotNumber.trim()) return;
    
    setIsSearching(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsSearching(false);
      return;
    }

    const { data: sales } = await supabase
      .from("sales")
      .select("*")
      .eq("user_id", user.id)
      .ilike("lot_number", `%${searchLotNumber.trim()}%`)
      .order("sale_date", { ascending: false });

    setSearchResults(sales || []);
    setIsSearching(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-primary">MANJUCOTTON Dashboard</h1>
        <p className="text-muted-foreground">Welcome to your dyed yarn inventory management system</p>
        <p className="text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inventory</CardTitle>
            <Scale className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalInventory.toFixed(2)} kg</div>
            <p className="text-xs text-muted-foreground">Across {stats.totalLots} lots</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
            <ShoppingCart className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todaySales.toFixed(2)} kg</div>
            <p className="text-xs text-muted-foreground">₹{Math.round(stats.todayRevenue)} total revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <Package className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.lowStockItems}</div>
            <p className="text-xs text-muted-foreground">Items below 10kg</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Lots</CardTitle>
            <BoxIcon className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLots}</div>
            <p className="text-xs text-muted-foreground">Active inventory lots</p>
          </CardContent>
        </Card>
      </div>

      {/* Search Sales by Lot Number */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Search Sales by Lot Number</h2>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Find Sales Records</CardTitle>
            </div>
            <CardDescription>
              Enter a lot number to view all sales history for that lot
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter lot number..."
                value={searchLotNumber}
                onChange={(e) => setSearchLotNumber(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="max-w-sm"
              />
              <Button onClick={handleSearch} disabled={isSearching}>
                <Search className="h-4 w-4 mr-2" />
                {isSearching ? "Searching..." : "Search"}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sale Date</TableHead>
                      <TableHead>Lot Number</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Bill No.</TableHead>
                      <TableHead>Count</TableHead>
                      <TableHead className="text-right">Weight (kg)</TableHead>
                      <TableHead className="text-right">Price/kg (₹)</TableHead>
                      <TableHead className="text-right">Total (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResults.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell>{new Date(sale.sale_date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-medium">{sale.lot_number}</TableCell>
                        <TableCell>{sale.customer_name}</TableCell>
                        <TableCell>{sale.bill_number}</TableCell>
                        <TableCell>{sale.count}</TableCell>
                        <TableCell className="text-right">{Number(sale.weight_sold).toFixed(2)}</TableCell>
                        <TableCell className="text-right">{Number(sale.price_per_kg).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold">₹{Math.round(Number(sale.total_amount))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {searchResults.length === 0 && searchLotNumber && !isSearching && (
              <p className="text-sm text-muted-foreground">No sales found for this lot number.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Quick Access</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/inventory")}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <CardTitle>Manage Inventory</CardTitle>
              </div>
              <CardDescription>
                Add new lots, check stock levels, and manage your yarn inventory.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/sales")}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-success" />
                <CardTitle>Record Sale</CardTitle>
              </div>
              <CardDescription>
                Record new sales and generate bills for customers.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}
