import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Download } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Bar, BarChart } from "recharts";

interface DailySale {
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

interface TrendData {
  date: string;
  revenue: number;
  sales: number;
  weight: number;
}

export default function Reports() {
  const [date, setDate] = useState<Date>(new Date());
  const [dateRange, setDateRange] = useState({ from: subDays(new Date(), 30), to: new Date() });
  const [sales, setSales] = useState<DailySale[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [stats, setStats] = useState({
    totalSales: 0,
    totalWeight: 0,
    totalRevenue: 0,
  });
  const [overallStats, setOverallStats] = useState({
    totalSales: 0,
    totalWeight: 0,
    totalRevenue: 0,
  });

  useEffect(() => {
    fetchDailySales();
  }, [date]);

  useEffect(() => {
    fetchTrendData();
  }, [dateRange]);

  const fetchDailySales = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const dateStr = format(date, "yyyy-MM-dd");

    const { data } = await supabase
      .from("sales")
      .select("*")
      .eq("user_id", user.id)
      .eq("sale_date", dateStr)
      .order("created_at", { ascending: false });

    setSales(data || []);

    const totalWeight = data?.reduce((sum, sale) => sum + Number(sale.weight_sold), 0) || 0;
    const totalRevenue = data?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0;

    setStats({
      totalSales: data?.length || 0,
      totalWeight,
      totalRevenue,
    });
  };

  const fetchTrendData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("sales")
      .select("*")
      .eq("user_id", user.id)
      .gte("sale_date", format(dateRange.from, "yyyy-MM-dd"))
      .lte("sale_date", format(dateRange.to, "yyyy-MM-dd"))
      .order("sale_date", { ascending: true });

    if (!data) return;

    // Group by date
    const grouped = data.reduce((acc, sale) => {
      const date = sale.sale_date;
      if (!acc[date]) {
        acc[date] = { revenue: 0, sales: 0, weight: 0 };
      }
      acc[date].revenue += Number(sale.total_amount);
      acc[date].sales += 1;
      acc[date].weight += Number(sale.weight_sold);
      return acc;
    }, {} as Record<string, { revenue: number; sales: number; weight: number }>);

    const trends = Object.entries(grouped).map(([date, values]) => ({
      date: format(new Date(date), "MMM dd"),
      ...values,
    }));

    setTrendData(trends);

    const totalWeight = data.reduce((sum, sale) => sum + Number(sale.weight_sold), 0);
    const totalRevenue = data.reduce((sum, sale) => sum + Number(sale.total_amount), 0);

    setOverallStats({
      totalSales: data.length,
      totalWeight,
      totalRevenue,
    });
  };

  const handleExport = () => {
    const csvContent = [
      ["Lot Number", "Count", "Customer", "Bill Number", "Weight (kg)", "Price/kg", "Total Amount"].join(","),
      ...sales.map((sale) =>
        [
          sale.lot_number,
          sale.count,
          sale.customer_name,
          sale.bill_number,
          sale.weight_sold.toFixed(2),
          sale.price_per_kg.toFixed(2),
          sale.total_amount.toFixed(2),
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-report-${format(date, "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">Sales Reports</h1>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Revenue Trends</h2>
        <p className="text-muted-foreground mb-4">
          Overview for last 30 days
        </p>

        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.totalSales}</div>
              <p className="text-xs text-muted-foreground">transactions in period</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Weight Sold</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.totalWeight.toFixed(2)} kg</div>
              <p className="text-xs text-muted-foreground">in period</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{overallStats.totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">in period</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{ revenue: { label: "Revenue", color: "hsl(var(--primary))" } }} className="h-[300px]">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Sales Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{ sales: { label: "Sales", color: "hsl(var(--primary))" } }} className="h-[300px]">
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="sales" fill="hsl(var(--primary))" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">Daily Sales Report</h2>
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(date, "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
            </PopoverContent>
          </Popover>
          {sales.length > 0 && (
            <Button onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          )}
        </div>
      </div>

      <div>
        <p className="text-muted-foreground mb-6">View sales data for a specific date</p>

        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSales}</div>
              <p className="text-xs text-muted-foreground">
                transactions on {format(date, "MMMM do, yyyy")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Weight Sold</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalWeight.toFixed(2)} kg</div>
              <p className="text-xs text-muted-foreground">
                on {format(date, "MMMM do, yyyy")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{stats.totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                on {format(date, "MMMM do, yyyy")}
              </p>
            </CardContent>
          </Card>
        </div>

        {sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
            <p className="text-muted-foreground">
              No sales recorded for {format(date, "MMMM do, yyyy")}
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lot Number</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Bill Number</TableHead>
                  <TableHead className="text-right">Weight (kg)</TableHead>
                  <TableHead className="text-right">Price per kg</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium">{sale.lot_number}</TableCell>
                    <TableCell>{sale.count}</TableCell>
                    <TableCell>{sale.customer_name}</TableCell>
                    <TableCell>{sale.bill_number}</TableCell>
                    <TableCell className="text-right">{sale.weight_sold.toFixed(2)}</TableCell>
                    <TableCell className="text-right">₹{sale.price_per_kg.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      ₹{sale.total_amount.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
