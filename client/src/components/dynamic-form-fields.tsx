import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface DynamicFormFieldsProps {
  title: string;
  fields: any[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
  renderField: (field: any, index: number) => ReactNode;
}

export default function DynamicFormFields({
  title,
  fields,
  onAdd,
  onRemove,
  disabled = false,
  renderField,
}: DynamicFormFieldsProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAdd}
          disabled={disabled}
          className="text-primary hover:text-primary-foreground"
        >
          <Plus className="h-4 w-4 mr-1" />
          Aggiungi
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {fields.map((field, index) => renderField(field, index))}
        </div>
      </CardContent>
    </Card>
  );
}
