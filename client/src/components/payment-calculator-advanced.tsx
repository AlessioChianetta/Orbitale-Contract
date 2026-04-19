import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Calculator, Calendar, Euro, Gift, Percent, Edit3, Save, X, RotateCcw } from "lucide-react";
import { calculateDiscountedPrice, formatCurrency, generatePaymentDates } from "@/lib/validation-utils";
import { format } from "date-fns";

interface PaymentPlan {
  rata_importo: string;
  rata_scadenza: string;
}

type Frequency = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

interface FirstMonthDiscount {
  enabled: boolean;
  type: 'percentage' | 'fixed';
  value: number;
}

interface PaymentCalculatorAdvancedProps {
  totalAmount: number;
  onPaymentPlanChange: (paymentPlan: PaymentPlan[]) => void;
  disabled?: boolean;
  initialFrequency?: Frequency;
  initialIsSubscription?: boolean;
  initialFirstMonthDiscount?: FirstMonthDiscount;
  onFrequencyChange?: (value: Frequency) => void;
  onIsSubscriptionChange?: (value: boolean) => void;
  onFirstMonthDiscountChange?: (value: FirstMonthDiscount) => void;
}

export default function PaymentCalculatorAdvanced({
  totalAmount,
  onPaymentPlanChange,
  disabled = false,
  initialFrequency = 'annual',
  initialIsSubscription = false,
  initialFirstMonthDiscount,
  onFrequencyChange,
  onIsSubscriptionChange,
  onFirstMonthDiscountChange,
}: PaymentCalculatorAdvancedProps) {
  const [paymentFrequency, setPaymentFrequency] = useState<Frequency>(initialFrequency);
  const [startDate] = useState(new Date());
  const [isSubscription, setIsSubscription] = useState<boolean>(initialIsSubscription);
  const [firstMonthDiscount, setFirstMonthDiscount] = useState<FirstMonthDiscount>(
    initialFirstMonthDiscount ?? {
      enabled: false,
      type: 'percentage',
      value: 50,
    },
  );

  const onFrequencyChangeRef = useRef(onFrequencyChange);
  const onIsSubscriptionChangeRef = useRef(onIsSubscriptionChange);
  const onFirstMonthDiscountChangeRef = useRef(onFirstMonthDiscountChange);
  useEffect(() => { onFrequencyChangeRef.current = onFrequencyChange; }, [onFrequencyChange]);
  useEffect(() => { onIsSubscriptionChangeRef.current = onIsSubscriptionChange; }, [onIsSubscriptionChange]);
  useEffect(() => { onFirstMonthDiscountChangeRef.current = onFirstMonthDiscountChange; }, [onFirstMonthDiscountChange]);

  useEffect(() => { onFrequencyChangeRef.current?.(paymentFrequency); }, [paymentFrequency]);
  useEffect(() => { onIsSubscriptionChangeRef.current?.(isSubscription); }, [isSubscription]);
  useEffect(() => { onFirstMonthDiscountChangeRef.current?.(firstMonthDiscount); }, [firstMonthDiscount]);
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlan[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingPayment, setEditingPayment] = useState({ amount: '', date: '' });
  const [hasManualEdits, setHasManualEdits] = useState(false);

  // Keep the latest callback in a ref so we can notify the parent without
  // re-triggering the plan regeneration effect whenever the parent re-renders.
  const onPaymentPlanChangeRef = useRef(onPaymentPlanChange);
  useEffect(() => {
    onPaymentPlanChangeRef.current = onPaymentPlanChange;
  }, [onPaymentPlanChange]);

  const generatePlan = (): PaymentPlan[] => {
    if (totalAmount <= 0) return [];
    const calculation = calculateDiscountedPrice(totalAmount, paymentFrequency);
    const paymentDates = generatePaymentDates(startDate, paymentFrequency, calculation.numberOfPayments);

    return paymentDates.map((date, index) => {
      let amount = calculation.installmentAmount;

      if (isSubscription && firstMonthDiscount.enabled && index === 0) {
        if (firstMonthDiscount.type === 'percentage') {
          amount = amount * (1 - firstMonthDiscount.value / 100);
        } else {
          amount = Math.max(0, amount - firstMonthDiscount.value);
        }
      }

      return {
        rata_importo: amount.toFixed(2),
        rata_scadenza: format(date, 'dd/MM/yyyy'),
      };
    });
  };

  // Rigenera il piano solo quando cambiano gli input del calcolo automatico.
  // `editingIndex` è volutamente fuori dalle dipendenze: non vogliamo
  // rigenerare il piano ogni volta che l'utente entra/esce dalla modalità
  // modifica (altrimenti le modifiche manuali verrebbero sovrascritte).
  useEffect(() => {
    if (totalAmount <= 0) {
      setPaymentPlan([]);
      onPaymentPlanChangeRef.current([]);
      return;
    }
    const newPlan = generatePlan();
    setPaymentPlan(newPlan);
    setHasManualEdits(false);
    onPaymentPlanChangeRef.current(newPlan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalAmount, paymentFrequency, isSubscription, firstMonthDiscount.enabled, firstMonthDiscount.type, firstMonthDiscount.value]);

  const handleFrequencyChange = (value: Frequency) => {
    if (hasManualEdits) {
      const ok = window.confirm(
        'Hai modificato manualmente alcune rate. Cambiando la frequenza le modifiche verranno sostituite dal calcolo automatico. Continuare?'
      );
      if (!ok) return;
    }
    setPaymentFrequency(value);
  };

  const handleEditPayment = (index: number) => {
    setEditingIndex(index);
    setEditingPayment({
      amount: paymentPlan[index].rata_importo,
      date: paymentPlan[index].rata_scadenza,
    });
  };

  const handleSavePayment = () => {
    if (editingIndex === null) return;

    const parsedAmount = parseFloat(editingPayment.amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) return;
    if (!editingPayment.date) return;

    const updatedPlan = [...paymentPlan];
    updatedPlan[editingIndex] = {
      rata_importo: parsedAmount.toFixed(2),
      rata_scadenza: editingPayment.date,
    };

    setPaymentPlan(updatedPlan);
    setHasManualEdits(true);
    setEditingIndex(null);
    setEditingPayment({ amount: '', date: '' });
    onPaymentPlanChangeRef.current(updatedPlan);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingPayment({ amount: '', date: '' });
  };

  const handleResetPlan = () => {
    const newPlan = generatePlan();
    setPaymentPlan(newPlan);
    setHasManualEdits(false);
    setEditingIndex(null);
    setEditingPayment({ amount: '', date: '' });
    onPaymentPlanChangeRef.current(newPlan);
  };

  if (totalAmount <= 0) {
    return null;
  }

  const calculation = calculateDiscountedPrice(totalAmount, paymentFrequency);
  const currentTotal = paymentPlan.reduce((sum, p) => sum + parseFloat(p.rata_importo || '0'), 0);

  return (
    <Card className="mt-6 border-2 border-purple-100 shadow-lg bg-gradient-to-br from-purple-50 to-white">
      <CardHeader className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Calculator className="h-5 w-5" />
          Calcolatore Pagamenti
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Total Amount Display */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Prezzo totale contratto</span>
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
                      setFirstMonthDiscount((prev) => ({ ...prev, enabled: !!checked }))
                    }
                    disabled={disabled}
                  />
                  <Label htmlFor="first-month-discount" className="text-sm font-medium text-green-800">
                    Sconto Prima Rata
                  </Label>
                </div>

                {firstMonthDiscount.enabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Select
                      value={firstMonthDiscount.type}
                      onValueChange={(value) =>
                        setFirstMonthDiscount((prev) => ({ ...prev, type: value as 'percentage' | 'fixed' }))
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
                        setFirstMonthDiscount((prev) => ({
                          ...prev,
                          value: Math.max(0, Number(e.target.value)),
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
              onValueChange={(value) => handleFrequencyChange(value as Frequency)}
              disabled={disabled}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {([
                { id: 'annual', label: 'Annuale', sub: 'Unico pagamento' },
                { id: 'semiannual', label: 'Semestrale', sub: '2 rate' },
                { id: 'quarterly', label: 'Trimestrale', sub: '4 rate' },
                { id: 'monthly', label: 'Mensile', sub: '12 rate' },
              ] as const).map((opt) => {
                const installment = calculation.numberOfPayments > 0
                  ? totalAmount / ({ annual: 1, semiannual: 2, quarterly: 4, monthly: 12 } as const)[opt.id]
                  : 0;
                return (
                  <div key={opt.id} className="relative">
                    <RadioGroupItem value={opt.id} id={opt.id} className="peer sr-only" />
                    <Label
                      htmlFor={opt.id}
                      className="flex items-center justify-between rounded-lg border-2 border-gray-200 bg-white p-4 hover:bg-gray-50 cursor-pointer peer-checked:border-purple-600 peer-checked:bg-purple-50 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-gray-600" />
                        <div>
                          <div className="font-semibold">{opt.label}</div>
                          <div className="text-xs text-gray-500">{opt.sub}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{formatCurrency(installment)}</div>
                        <div className="text-xs text-gray-500">per rata</div>
                      </div>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {/* Price Summary */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-700">Totale da pagare:</span>
              <span className="text-xl font-bold text-blue-700">{formatCurrency(totalAmount)}</span>
            </div>
            {hasManualEdits && Math.abs(currentTotal - totalAmount) > 0.01 && (
              <div className="mt-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded p-2">
                Attenzione: la somma delle rate modificate ({formatCurrency(currentTotal)}) non corrisponde al prezzo totale ({formatCurrency(totalAmount)}).
              </div>
            )}
          </div>

          {/* Detailed Payment Schedule */}
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-600" />
                <h4 className="font-semibold text-gray-800 text-sm">Calendario Pagamenti</h4>
              </div>
              {hasManualEdits && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleResetPlan}
                  disabled={disabled}
                  className="h-8 text-xs text-purple-700 hover:text-purple-900 hover:bg-purple-50"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Ripristina automatico
                </Button>
              )}
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {paymentPlan.map((payment, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                  <span className="text-sm font-medium text-gray-600 shrink-0">
                    Rata {index + 1}
                  </span>

                  {editingIndex === index ? (
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editingPayment.amount}
                        onChange={(e) => setEditingPayment((prev) => ({ ...prev, amount: e.target.value }))}
                        className="w-24 h-8 text-xs"
                        placeholder="Importo"
                      />
                      <Input
                        type="date"
                        value={editingPayment.date ? editingPayment.date.split('/').reverse().join('-') : ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            const parts = e.target.value.split('-');
                            setEditingPayment((prev) => ({
                              ...prev,
                              date: `${parts[2]}/${parts[1]}/${parts[0]}`,
                            }));
                          }
                        }}
                        className="w-36 h-8 text-xs"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={handleSavePayment}
                        aria-label="Salva modifica"
                      >
                        <Save className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={handleCancelEdit}
                        aria-label="Annulla modifica"
                      >
                        <X className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-bold text-gray-800">
                          {formatCurrency(parseFloat(payment.rata_importo))}
                        </div>
                        <div className="text-xs text-gray-500">
                          il {payment.rata_scadenza}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => handleEditPayment(index)}
                        disabled={disabled}
                        aria-label={`Modifica rata ${index + 1}`}
                      >
                        <Edit3 className="h-4 w-4 text-purple-600" />
                      </Button>
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
                    Prima rata scontata:{' '}
                    {firstMonthDiscount.type === 'percentage'
                      ? `${firstMonthDiscount.value}% di sconto`
                      : `${formatCurrency(firstMonthDiscount.value)} di sconto`}
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
