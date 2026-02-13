import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { z } from "zod";

interface AddLotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const lotSchema = z.object({
  lot_number: z.string().trim().min(1, "Lot number required").max(50, "Lot number too long").regex(/^[A-Z0-9-]+$/i, "Invalid lot number format"),
  count: z.string().trim().min(1, "Count required").max(20, "Count too long"),
  shade: z.string().trim().max(50, "Shade too long").optional(),
  party_name: z.string().trim().max(100, "Party name too long").optional(),
  cones: z.number().int().min(0, "Cones must be positive").max(10000, "Cones unrealistic"),
  weight: z.number().positive("Weight must be positive").max(100000, "Weight unrealistic")
});

export function AddLotDialog({ open, onOpenChange }: AddLotDialogProps) {
  const [formData, setFormData] = useState({
    lot_number: "",
    count: "",
    shade: "",
    cones: "",
    weight: "",
    party_name: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    try {
      // Validate inputs
      const validation = lotSchema.safeParse({
        lot_number: formData.lot_number,
        count: formData.count,
        shade: formData.shade || undefined,
        party_name: formData.party_name || undefined,
        cones: parseInt(formData.cones) || 0,
        weight: parseFloat(formData.weight)
      });

      if (!validation.success) {
        const firstError = validation.error.errors[0];
        toast.error(firstError.message);
        setUploading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let imageUrl = null;

      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("lot-images")
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("lot-images")
          .getPublicUrl(fileName);

        imageUrl = publicUrl;
      }

      const { error } = await supabase.from("lots").insert({
        user_id: user.id,
        lot_number: validation.data.lot_number,
        count: validation.data.count,
        shade: validation.data.shade || null,
        cones: validation.data.cones,
        weight: validation.data.weight,
        party_name: validation.data.party_name || null,
        image_url: imageUrl,
      });

      if (error) throw error;

      toast.success("Lot added successfully!");
      onOpenChange(false);
      setFormData({
        lot_number: "",
        count: "",
        shade: "",
        cones: "",
        weight: "",
        party_name: "",
      });
      setImageFile(null);
    } catch (error: any) {
      toast.error(error.message || "Error adding lot");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Lot</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lot_number">Lot Number *</Label>
              <Input
                id="lot_number"
                placeholder="MS-3712"
                value={formData.lot_number}
                onChange={(e) => setFormData({ ...formData, lot_number: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="count">Count *</Label>
              <Input
                id="count"
                placeholder="20s, 24s, 30s, etc."
                value={formData.count}
                onChange={(e) => setFormData({ ...formData, count: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shade">Shade</Label>
              <Input
                id="shade"
                placeholder="Red, Blue, etc."
                value={formData.shade}
                onChange={(e) => setFormData({ ...formData, shade: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cones">Number of Cones</Label>
              <Input
                id="cones"
                type="number"
                placeholder="0"
                value={formData.cones}
                onChange={(e) => setFormData({ ...formData, cones: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (kg) *</Label>
              <Input
                id="weight"
                type="number"
                step="0.01"
                placeholder="100.00"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="party_name">Party Name</Label>
              <Input
                id="party_name"
                placeholder="Enter party name"
                value={formData.party_name}
                onChange={(e) => setFormData({ ...formData, party_name: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="image">Lot Image</Label>
            <div className="flex items-center gap-2">
              <Input
                id="image"
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              />
              {imageFile && (
                <span className="text-sm text-muted-foreground">
                  {imageFile.name}
                </span>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={uploading}>
              {uploading ? "Adding..." : "Add Lot"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
