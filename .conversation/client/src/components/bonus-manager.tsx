import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Gift } from "lucide-react";

interface Bonus {
  description: string;
  value?: string;
  type?: 'fixed' | 'percentage';
}

interface BonusManagerProps {
  bonuses: Bonus[];
  onChange: (bonuses: Bonus[]) => void;
  disabled?: boolean;
}

export default function BonusManager({ bonuses, onChange, disabled = false }: BonusManagerProps) {
  const addBonus = () => {
    onChange([...bonuses, { description: '', value: '', type: 'fixed' }]);
  };

  const removeBonus = (index: number) => {
    const newBonuses = bonuses.filter((_, i) => i !== index);
    onChange(newBonuses);
  };

  const updateBonus = (index: number, field: keyof Bonus, value: string) => {
    const newBonuses = bonuses.map((bonus, i) => 
      i === index ? { ...bonus, [field]: value } : bonus
    );
    onChange(newBonuses);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5" />
          Bonus Predefiniti
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Configura i bonus che saranno disponibili in tutti i contratti basati su questo template.
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {bonuses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Gift className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nessun bonus configurato</p>
            <p className="text-sm">Aggiungi bonus predefiniti per questo template</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bonuses.map((bonus, index) => (
              <div key={index} className="flex items-end gap-4 p-4 border rounded-lg">
                <div className="flex-1 space-y-2">
                  <Label htmlFor={`bonus-desc-${index}`}>Descrizione</Label>
                  <Input
                    id={`bonus-desc-${index}`}
                    value={bonus.description}
                    onChange={(e) => updateBonus(index, 'description', e.target.value)}
                    placeholder="es. Sconto fedeltà, Regalo di benvenuto..."
                    disabled={disabled}
                  />
                </div>
                
                <div className="w-32 space-y-2">
                  <Label htmlFor={`bonus-value-${index}`}>Valore</Label>
                  <div className="flex gap-2">
                    <Input
                      id={`bonus-value-${index}`}
                      value={bonus.value || ''}
                      onChange={(e) => updateBonus(index, 'value', e.target.value)}
                      placeholder="100"
                      className="flex-1"
                      disabled={disabled}
                    />
                    <Select
                      value={bonus.type || 'fixed'}
                      onValueChange={(value: 'fixed' | 'percentage') => 
                        updateBonus(index, 'type', value)
                      }
                      disabled={disabled}
                    >
                      <SelectTrigger className="w-16">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">€</SelectItem>
                        <SelectItem value="percentage">%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeBonus(index)}
                  disabled={disabled}
                  className="text-red-600 hover:text-red-800"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        
        <Button
          type="button"
          variant="outline"
          onClick={addBonus}
          disabled={disabled}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Aggiungi Bonus
        </Button>
        
        {bonuses.length > 0 && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium mb-2">Anteprima bonus nel contratto:</p>
            <div className="flex flex-wrap gap-2">
              {bonuses
                .filter(bonus => bonus.description.trim() !== '')
                .map((bonus, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {bonus.description}
                    {bonus.value && (
                      <span className="ml-1">
                        ({bonus.value}{bonus.type === 'percentage' ? '%' : '€'})
                      </span>
                    )}
                  </Badge>
                ))
              }
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}