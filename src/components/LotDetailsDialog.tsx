import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

interface LotDetailsDialogProps {
  lot: Lot;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function LotDetailsDialog({ lot, open, onOpenChange, onUpdate }: LotDetailsDialogProps) {
  const handleDelete = async () => {
    try {
      const { error } = await supabase.from("lots").delete().eq("id", lot.id);

      if (error) throw error;

      toast.success("Lot deleted successfully!");
      onOpenChange(false);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || "Error deleting lot");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Lot Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {lot.image_url && (
            <div className="w-full">
              <img
                src={lot.image_url}
                alt={lot.lot_number}
                className="w-full h-64 object-cover rounded-lg"
              />
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Lot Number</p>
              <p className="text-lg font-semibold">{lot.lot_number}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Count</p>
              <p className="text-lg font-semibold">{lot.count}</p>
            </div>
            {lot.shade && (
              <div>
                <p className="text-sm text-muted-foreground">Shade</p>
                <p className="text-lg font-semibold">{lot.shade}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Cones</p>
              <p className="text-lg font-semibold">{lot.cones}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Weight</p>
              <p className="text-lg font-semibold">
                {lot.weight != null ? Number(lot.weight).toFixed(2) : '0.00'} kg
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Price per kg</p>
              <p className="text-lg font-semibold">
                ₹{lot.price_per_kg != null ? Number(lot.price_per_kg).toFixed(2) : '0.00'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-lg font-semibold">
                ₹{(lot.weight != null && lot.price_per_kg != null 
                  ? (Number(lot.weight) * Number(lot.price_per_kg)).toFixed(2) 
                  : '0.00')}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={(lot.weight ?? 0) < 10 ? "destructive" : "secondary"}>
                {(lot.weight ?? 0) < 10 ? "Low Stock" : "In Stock"}
              </Badge>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Lot
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete lot {lot.lot_number} and all associated data.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
