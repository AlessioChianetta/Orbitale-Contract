import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Calculator, Calendar, Euro, TrendingUp, Gift, Percent, Clock, Edit3, Save, X } from "lucide-react";
import { calculateDiscountedPrice, formatCurrency, generatePaymentDates } from "@/lib/validation-utils";
import { format, addDays } from "date-fns";
import { it } from "date-fns/locale";

interface PaymentPlan {
  rata_importo: string;
  rata_scadenza: string;
}

interface PaymentCalculatorAdvancedProps {
  totalAmount: number;
  onPaymentPlanChange: (paymentPlan: PaymentPlan[]) => void;
  disabled?: boolean;
}

export default function PaymentCalculatorAdvanced({
  totalAmount,
  onPaymentPlanChange,
  disabled = false
}: PaymentCalculatorAdvancedProps) {
  const [paymentFrequency, setPaymentFrequency] = useState<'monthly' | 'quarterly' | 'semiannual' | 'annual'>('annual');
  const [startDate, setStartDate] = useState(new Date());
  const [isSubscription, setIsSubscription] = useState(false);
  const [firstMonthDiscount, setFirstMonthDiscount] = useState({
    enabled: false,
    type: 'percentage' as 'percentage' | 'fixed',
    value: 50
  });
  const [customStartDate, setCustomStartDate] = useState(false);
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlan[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingPayment, setEditingPayment] = useState({ amount: '', date: '' });

  useEffect(() => {
    console.log('🔄 useEffect PRINCIPALE triggerato!');
    console.log('📊 totalAmount:', totalAmount);
    console.log('📅 paymentFrequency:', paymentFrequency);
    console.log('📝 editingIndex:', editingIndex);
    console.log('📋 paymentPlan.length:', paymentPlan.length);
    console.log('🎯 Sono in modalità editing?', editingIndex !== null);

    // BLOCCO COMPLETO se siamo in edit mode
    if (editingIndex !== null) {
      console.log('⚠️ EDIT MODE ATTIVO - editingIndex:', editingIndex);
      console.log('🚫 BLOCCATO - Sono in edit mode, non rigenero il piano!');
      return;
    }

    // Solo se NON siamo in edit mode E totalAmount > 0
    if (totalAmount > 0) {
      console.log('✅ Generando nuovo piano pagamenti...');
      const calculation = calculateDiscountedPrice(totalAmount, paymentFrequency);
      const paymentDates = generatePaymentDates(startDate, paymentFrequency, calculation.numberOfPayments);

      const newPaymentPlan = paymentDates.map((date, index) => {
        let amount = calculation.installmentAmount;

        // Apply first month discount for subscriptions
        if (isSubscription && firstMonthDiscount.enabled && index === 0) {
          if (firstMonthDiscount.type === 'percentage') {
            amount = amount * (1 - firstMonthDiscount.value / 100);
          } else {
            amount = Math.max(0, amount - firstMonthDiscount.value);
          }
        }

        return {
          rata_importo: amount.toFixed(2),
          rata_scadenza: format(date, 'dd/MM/yyyy')
        };
      });
      console.log('NEW PAYMENT PLAN', newPaymentPlan);
      setPaymentPlan(newPaymentPlan);
      onPaymentPlanChange(newPaymentPlan);
    } else {
      console.log('⚠️ totalAmount è 0 o negativo, non genero piano');
    }
  }, [totalAmount, paymentFrequency, startDate, isSubscription, firstMonthDiscount, editingIndex]);

  const handleEditPayment = (index: number) => {
    console.log('✏️✏️✏️ CLICK SU MODIFICA PAGAMENTO - Entrando in edit mode ✏️✏️✏️');
    console.log('📝 index da modificare:', index);
    console.log('💰 pagamento attuale:', paymentPlan[index]);
    console.log('📋 paymentPlan completo prima della modifica:', paymentPlan);
    console.log('🎯 editingIndex PRIMA di entrare in edit:', editingIndex);
    alert("ENTRANDO IN EDIT MODE - Guarda la console!");

    setEditingIndex(index);
    setEditingPayment({
      amount: paymentPlan[index].rata_importo,
      date: paymentPlan[index].rata_scadenza
    });

    console.log('✅ Edit mode attivato - editingIndex impostato a:', index);
    console.log('⚠️ ATTENZIONE: Ora il useEffect dovrebbe essere BLOCCATO!');
  };

  const handleSavePayment = () => {
    console.log('🔍 CLICK SU SALVA PAGAMENTO - Inizio funzione');
    console.log('📝 editingIndex:', editingIndex);
    console.log('💰 editingPayment:', editingPayment);
    console.log('📋 paymentPlan attuale:', paymentPlan);

    if (editingIndex !== null) {
      const updatedPlan = [...paymentPlan];
      updatedPlan[editingIndex] = {
        rata_importo: editingPayment.amount,
        rata_scadenza: editingPayment.date
      };

      console.log('📊 updatedPlan creato:', updatedPlan);
      
      setPaymentPlan(updatedPlan);
      setEditingIndex(null);
      setEditingPayment({ amount: '', date: '' });

      console.log('✅ Modifica salvata localmente senza triggerare salvataggio automatico');
    } else {
      console.log('❌ editingIndex è null - non faccio nulla');
    }
  };

  // Function to manually update the payment plan when user confirms changes
  const handleUpdatePaymentPlan = () => {
    console.log("🎯 CLICK SU APPLICA MODIFICHE - Chiamando onPaymentPlanChange");
    console.log("📋 paymentPlan che sto inviando:", paymentPlan);
    onPaymentPlanChange(paymentPlan);
    console.log("✅ onPaymentPlanChange chiamato");
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingPayment({ amount: '', date: '' });
  };

  if (totalAmount <= 0) {
    return null;
  }

  const calculation = calculateDiscountedPrice(totalAmount, paymentFrequency);

  return (
    <Card className="mt-6 border-2 border-purple-100 shadow-lg bg-gradient-to-br from-purple-50 to-white">
      <CardHeader className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Calculator className="h-5 w-5" />
          Calcolatore Pagamenti Intelligente
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Total Amount Display */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Prezzo Base Annuale</span>
              <span className="text-2xl font-bold text-gray-900">{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          {/* Subscription Mode Toggle */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="subscription-mode"
                checked={isSubscription}
                onCheckedChange={(checked) => setIsSubscription(!!checked)}
                disabled={disabled}
              />
              <Label htmlFor="subscription-mode" className="text-sm font-medium text-blue-800">
                Modalità Abbonamento (pagamento ricorrente)
              </Label>
            </div>
            {isSubscription && (
              <div className="mt-3 text-xs text-blue-600">
                In modalità abbonamento, i pagamenti si ripeteranno automaticamente secondo la frequenza selezionata.
              </div>
            )}
          </div>

          {/* First Month Discount (only for subscriptions) */}
          {isSubscription && (
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="first-month-discount"
                    checked={firstMonthDiscount.enabled}
                    onCheckedChange={(checked) => 
                      setFirstMonthDiscount(prev => ({ ...prev, enabled: !!checked }))
                    }
                    disabled={disabled}
                  />
                  <Label htmlFor="first-month-discount" className="text-sm font-medium text-green-800">
                    Sconto Primo Mese
                  </Label>
                </div>

                {firstMonthDiscount.enabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Select
                      value={firstMonthDiscount.type}
                      onValueChange={(value) => 
                        setFirstMonthDiscount(prev => ({ ...prev, type: value as 'percentage' | 'fixed' }))
                      }
                      disabled={disabled}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">
                          <div className="flex items-center gap-2">
                            <Percent className="h-4 w-4" />
                            Percentuale
                          </div>
                        </SelectItem>
                        <SelectItem value="fixed">
                          <div className="flex items-center gap-2">
                            <Euro className="h-4 w-4" />
                            Importo Fisso
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    <Input
                      type="number"
                      placeholder={firstMonthDiscount.type === 'percentage' ? '50' : '100'}
                      value={firstMonthDiscount.value}
                      onChange={(e) => 
                        setFirstMonthDiscount(prev => ({ 
                          ...prev, 
                          value: Math.max(0, Number(e.target.value)) 
                        }))
                      }
                      disabled={disabled}
                      className="text-center"
                    />

                    <div className="flex items-center text-sm text-green-700">
                      {firstMonthDiscount.type === 'percentage' ? (
                        <>
                          <Percent className="h-4 w-4 mr-1" />
                          Sconto {firstMonthDiscount.value}%
                        </>
                      ) : (
                        <>
                          <Euro className="h-4 w-4 mr-1" />
                          -{formatCurrency(firstMonthDiscount.value)}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}



          {/* Payment Frequency Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold text-gray-700">Frequenza di Pagamento</Label>
            <RadioGroup
              value={paymentFrequency}
              onValueChange={(value) => setPaymentFrequency(value as any)}
              disabled={disabled}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              <div className="relative">
                <RadioGroupItem value="annual" id="annual" className="peer sr-only" />
                <Label
                  htmlFor="annual"
                  className="flex items-center justify-between rounded-lg border-2 border-gray-200 bg-white p-4 hover:bg-gray-50 cursor-pointer peer-checked:border-purple-600 peer-checked:bg-purple-50 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-gray-600" />
                    <div>
                      <div className="font-semibold">Annuale</div>
                      <div className="text-xs text-gray-500">Unico pagamento</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatCurrency(calculation.installmentAmount)}</div>
                    <div className="text-xs text-green-600 font-semibold">Prezzo base</div>
                  </div>
                </Label>
                {paymentFrequency === 'annual' && calculation.freeBonusText && (
                  <Badge className="absolute -top-2 -right-2 bg-green-500 animate-pulse">{calculation.freeBonusText}</Badge>
                )}
              </div>

              <div className="relative">
                <RadioGroupItem value="semiannual" id="semiannual" className="peer sr-only" />
                <Label
                  htmlFor="semiannual"
                  className="flex items-center justify-between rounded-lg border-2 border-gray-200 bg-white p-4 hover:bg-gray-50 cursor-pointer peer-checked:border-purple-600 peer-checked:bg-purple-50 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-gray-600" />
                    <div>
                      <div className="font-semibold">Semestrale</div>
                      <div className="text-xs text-gray-500">2 rate</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatCurrency(calculation.installmentAmount)}</div>
                    <div className="text-xs text-orange-600 font-semibold">+{calculation.extraCostPercentage.toFixed(1)}%</div>
                  </div>
                </Label>
                {paymentFrequency === 'semiannual' && calculation.freeBonusText && (
                  <Badge className="absolute -top-2 -right-2 bg-green-500">{calculation.freeBonusText}</Badge>
                )}
              </div>

              <div className="relative">
                <RadioGroupItem value="quarterly" id="quarterly" className="peer sr-only" />
                <Label
                  htmlFor="quarterly"
                  className="flex items-center justify-between rounded-lg border-2 border-gray-200 bg-white p-4 hover:bg-gray-50 cursor-pointer peer-checked:border-purple-600 peer-checked:bg-purple-50 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-gray-600" />
                    <div>
                      <div className="font-semibold">Trimestrale</div>
                      <div className="text-xs text-gray-500">4 rate</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatCurrency(calculation.installmentAmount)}</div>
                    <div className="text-xs text-orange-600 font-semibold">+{calculation.extraCostPercentage.toFixed(1)}%</div>
                  </div>
                </Label>
                {paymentFrequency === 'quarterly' && calculation.freeBonusText && (
                  <Badge className="absolute -top-2 -right-2 bg-green-500">{calculation.freeBonusText}</Badge>
                )}
              </div>

              <div className="relative">
                <RadioGroupItem value="monthly" id="monthly" className="peer sr-only" />
                <Label
                  htmlFor="monthly"
                  className="flex items-center justify-between rounded-lg border-2 border-gray-200 bg-white p-4 hover:bg-gray-50 cursor-pointer peer-checked:border-purple-600 peer-checked:bg-purple-50 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-gray-600" />
                    <div>
                      <div className="font-semibold">Mensile</div>
                      <div className="text-xs text-gray-500">12 rate</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatCurrency(calculation.installmentAmount)}</div>
                    <div className="text-xs text-orange-600 font-semibold">+{calculation.extraCostPercentage.toFixed(1)}%</div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Price Summary */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center gap-3 mb-3">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <h4 className="font-semibold text-blue-800">Riepilogo Prezzo</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Prezzo base annuale:</span>
                <span className="text-sm text-gray-700">{formatCurrency(calculation.baseAnnualPrice)}</span>
              </div>
              {calculation.extraCost > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Sovrapprezzo rate:</span>
                  <span className="text-sm font-semibold text-orange-600">
                    +{formatCurrency(calculation.extraCost)} ({calculation.extraCostPercentage.toFixed(1)}%)
                  </span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between items-center">
                <span className="font-semibold text-gray-700">Totale da pagare:</span>
                <span className="text-xl font-bold text-blue-700">{formatCurrency(calculation.totalPrice)}</span>
              </div>
            </div>
          </div>

          {/* Detailed Payment Schedule */}
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-4 w-4 text-gray-600" />
              <h4 className="font-semibold text-gray-800 text-sm">Calendario Pagamenti Dettagliato</h4>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {paymentPlan.map((payment, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-600">
                      Rata {index + 1}
                    </span>
                  </div>

                  {editingIndex === index ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={editingPayment.amount}
                        onChange={(e) => setEditingPayment(prev => ({ ...prev, amount: e.target.value }))}
                        className="w-24 h-8 text-xs"
                        placeholder="Importo"
                      />
                      <Input
                        type="date"
                        value={editingPayment.date ? editingPayment.date.split('/').reverse().join('-') : ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            const parts = e.target.value.split('-');
                            setEditingPayment(prev => ({ 
                              ...prev, 
                              date: `${parts[2]}/${parts[1]}/${parts[0]}` 
                            }));
                          }
                        }}
                        className="w-32 h-8 text-xs"
                      />
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleSavePayment}>
                        <Save className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleCancelEdit}>
                        <X className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-800">
                        {formatCurrency(parseFloat(payment.rata_importo))}
                      </span>
                      <span className="text-sm text-gray-600">
                        il {payment.rata_scadenza}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            

            {isSubscription && (
              <div className="mt-3 p-2 bg-blue-100 rounded text-blue-700 text-xs">
                <Gift className="h-4 w-4 inline mr-1" />
                I pagamenti si ripeteranno automaticamente secondo la frequenza selezionata
                {firstMonthDiscount.enabled && (
                  <span className="block mt-1">
                    Prima rata scontata: {
                      firstMonthDiscount.type === 'percentage' 
                        ? `${firstMonthDiscount.value}% di sconto`
                        : `${formatCurrency(firstMonthDiscount.value)} di sconto`
                    }
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}