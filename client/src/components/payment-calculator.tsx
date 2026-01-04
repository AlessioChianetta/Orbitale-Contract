import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Calculator, Calendar, Euro } from "lucide-react";

interface PaymentPlan {
  rata_importo: string;
  rata_scadenza: string;
}

interface PaymentCalculatorProps {
  totalAmount: number;
  onPaymentPlanChange: (paymentPlan: PaymentPlan[]) => void;
  maxInstallments?: number;
  disabled?: boolean;
}

export default function PaymentCalculator({ 
  totalAmount, 
  onPaymentPlanChange,
  maxInstallments = 36,
  disabled = false
}: PaymentCalculatorProps) {
  const [installments, setInstallments] = useState<number>(1);
  const [frequency, setFrequency] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlan[]>([]);
  const [isSubscription, setIsSubscription] = useState<boolean>(false);
  const [subscriptionPromo, setSubscriptionPromo] = useState<{type: 'fixed' | 'percentage', value: number}>({type: 'percentage', value: 50});

  // Calcola l'importo di ogni rata
  const calculateInstallmentAmount = (total: number, numInstallments: number): number => {
    if (numInstallments <= 0 || total <= 0) return 0;
    return Math.round((total / numInstallments) * 100) / 100; // Arrotonda a 2 decimali
  };

  // Genera le date di scadenza partendo da oggi
  const generateDueDates = (numInstallments: number, freq: string): string[] => {
    const dates: string[] = [];
    const now = new Date();
    
    for (let i = 0; i < numInstallments; i++) {
      const dueDate = new Date(now);
      
      switch (freq) {
        case 'monthly':
          // Prima rata oggi, poi ogni mese successivo
          dueDate.setMonth(now.getMonth() + i);
          dueDate.setDate(now.getDate());
          break;
        case 'quarterly':
          // Prima rata oggi, poi ogni 3 mesi
          dueDate.setMonth(now.getMonth() + i * 3);
          dueDate.setDate(now.getDate());
          break;
        case 'annual':
          // Prima rata oggi, poi ogni anno
          dueDate.setFullYear(now.getFullYear() + i);
          dueDate.setMonth(now.getMonth());
          dueDate.setDate(now.getDate());
          break;
      }
      
      // Format: DD/MM/YYYY
      const formattedDate = dueDate.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      
      dates.push(formattedDate);
    }
    
    return dates;
  };

  // Aggiorna il piano di pagamento quando cambiano i parametri
  useEffect(() => {
    if (totalAmount > 0 && (installments > 0 || isSubscription)) {
      let newPaymentPlan: PaymentPlan[] = [];
      
      if (isSubscription) {
        // Piano abbonamento infinito
        const regularAmount = totalAmount;
        const dueDates = generateDueDates(12, frequency); // Mostra i primi 12 mesi
        
        newPaymentPlan = dueDates.map((date, index) => {
          let amount = regularAmount;
          
          // Primo mese con promozione
          if (index === 0) {
            if (subscriptionPromo.type === 'fixed') {
              amount = subscriptionPromo.value;
            } else {
              amount = regularAmount * (subscriptionPromo.value / 100);
            }
          }
          
          return {
            rata_importo: amount.toFixed(2),
            rata_scadenza: date
          };
        });
      } else {
        // Piano rate normali
        const installmentAmount = calculateInstallmentAmount(totalAmount, installments);
        const dueDates = generateDueDates(installments, frequency);
        
        const totalCalculated = installmentAmount * installments;
        const difference = totalAmount - totalCalculated;
        
        newPaymentPlan = dueDates.map((date, index) => {
          let amount = installmentAmount;
          
          if (index === installments - 1 && difference !== 0) {
            amount += difference;
          }
          
          return {
            rata_importo: amount.toFixed(2),
            rata_scadenza: date
          };
        });
      }
      
      setPaymentPlan(newPaymentPlan);
      onPaymentPlanChange(newPaymentPlan);
    }
  }, [totalAmount, installments, frequency, isSubscription, subscriptionPromo]);

  const frequencyLabels = {
    monthly: 'Mensile',
    quarterly: 'Trimestrale', 
    annual: 'Annuale'
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Calcolo Automatico Rate
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Tipo di pagamento */}
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <Label className="text-base font-medium">Tipo di Pagamento:</Label>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="one-time"
                name="payment-type"
                checked={!isSubscription}
                onChange={() => setIsSubscription(false)}
                disabled={disabled}
              />
              <Label htmlFor="one-time">Pagamento unico/Rate</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="subscription"
                name="payment-type"
                checked={isSubscription}
                onChange={() => setIsSubscription(true)}
                disabled={disabled}
              />
              <Label htmlFor="subscription">Abbonamento</Label>
            </div>
          </div>
          
          {isSubscription && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
              <Label className="text-sm font-medium">Promozione Primo Mese:</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="promo-type">Tipo Sconto</Label>
                  <Select 
                    value={subscriptionPromo.type} 
                    onValueChange={(value: 'fixed' | 'percentage') => 
                      setSubscriptionPromo({...subscriptionPromo, type: value})
                    }
                    disabled={disabled}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Prezzo Fisso</SelectItem>
                      <SelectItem value="percentage">Percentuale</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="promo-value">
                    {subscriptionPromo.type === 'fixed' ? 'Prezzo (€)' : 'Sconto (%)'}
                  </Label>
                  <Input
                    id="promo-value"
                    type="number"
                    min={subscriptionPromo.type === 'fixed' ? 0 : 1}
                    max={subscriptionPromo.type === 'fixed' ? totalAmount : 100}
                    value={subscriptionPromo.value}
                    onChange={(e) => 
                      setSubscriptionPromo({
                        ...subscriptionPromo, 
                        value: parseFloat(e.target.value) || 0
                      })
                    }
                    disabled={disabled}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Impostazioni di calcolo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="total-amount">
              {isSubscription ? 'Importo Mensile' : 'Importo Totale'}
            </Label>
            <div className="relative">
              <Euro className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="total-amount"
                type="number"
                value={totalAmount || ''}
                disabled
                className="pl-9"
              />
            </div>
          </div>
          
          {!isSubscription && (
            <div className="space-y-2">
              <Label htmlFor="installments">Numero Rate</Label>
              <Input
                id="installments"
                type="number"
                min="1"
                max={maxInstallments}
                value={installments}
                onChange={(e) => setInstallments(parseInt(e.target.value) || 1)}
                disabled={disabled}
              />
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="frequency">Frequenza</Label>
            <Select 
              value={frequency} 
              onValueChange={(value: 'monthly' | 'quarterly' | 'annual') => setFrequency(value)}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Mensile</SelectItem>
                <SelectItem value="quarterly">Trimestrale</SelectItem>
                <SelectItem value="annual">Annuale</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        {/* Anteprima del piano di pagamento */}
        {paymentPlan.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {isSubscription ? 'Piano Abbonamento' : 'Piano di Pagamento'} ({frequencyLabels[frequency]})
              {isSubscription && <span className="text-sm text-blue-600">(infinito)</span>}
            </h4>
            
            <div className="max-h-64 overflow-y-auto space-y-2">
              {paymentPlan.map((payment, index) => (
                <div 
                  key={index}
                  className="flex justify-between items-center p-3 bg-muted/50 rounded-lg"
                >
                  <span className="font-medium">
                    Rata {index + 1}
                  </span>
                  <div className="text-right space-y-1">
                    <div className="font-semibold">€ {payment.rata_importo}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Scadenza:</span>
                      <input
                        type="date"
                        value={payment.rata_scadenza.split('/').reverse().join('-')}
                        onChange={(e) => {
                          const newDate = new Date(e.target.value);
                          const formattedDate = newDate.toLocaleDateString('it-IT', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          });
                          
                          const updatedPlan = [...paymentPlan];
                          updatedPlan[index] = {
                            ...updatedPlan[index],
                            rata_scadenza: formattedDate
                          };
                          setPaymentPlan(updatedPlan);
                          onPaymentPlanChange(updatedPlan);
                        }}
                        className="text-xs border rounded px-1 py-0.5 w-28"
                        disabled={disabled}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-3 bg-primary/10 rounded-lg">
              {isSubscription ? (
                <>
                  <div className="flex justify-between items-center font-semibold">
                    <span>Importo Normale:</span>
                    <span>€ {totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-green-700 mt-1">
                    <span>Primo Mese:</span>
                    <span>
                      € {subscriptionPromo.type === 'fixed' 
                        ? subscriptionPromo.value.toFixed(2) 
                        : (totalAmount * (subscriptionPromo.value / 100)).toFixed(2)
                      }
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Abbonamento • {frequencyLabels[frequency]} • Infinito
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center font-semibold">
                    <span>Totale:</span>
                    <span>€ {totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {installments} {installments === 1 ? 'rata' : 'rate'} • {frequencyLabels[frequency]}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}