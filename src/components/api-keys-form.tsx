"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "../supabase/supabase";
import { Database } from "@/types/database.types";
import { AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ApiKeysFormProps {
  userId: string;
}

type UserApiKeys = Database["public"]["Tables"]["user_api_keys"]["Row"];

export default function ApiKeysForm({ userId }: ApiKeysFormProps) {
  const [sendgridApiKey, setSendgridApiKey] = useState("");
  const [telnyxApiKey, setTelnyxApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [apiKeys, setApiKeys] = useState<UserApiKeys | null>(null);

  useEffect(() => {
    const fetchApiKeys = async () => {
      try {
        const { data, error } = await supabase
          .from("user_api_keys")
          .select("*")
          .eq("user_id", userId)
          .single();

        if (error && error.code !== "PGRST116") {
          console.error("Error fetching API keys:", error);
          return;
        }

        if (data) {
          setApiKeys(data);
          // Mask the API keys for security
          if (data.sendgrid_api_key) {
            setSendgridApiKey(
              "••••••••••••••••" + data.sendgrid_api_key.slice(-4),
            );
          }
          if (data.telnyx_api_key) {
            setTelnyxApiKey("••••••••••••••••" + data.telnyx_api_key.slice(-4));
          }
        }
      } catch (error) {
        console.error("Error fetching API keys:", error);
      }
    };

    fetchApiKeys();
  }, [userId]);

  const handleSubmit = async () => {
    setFormError("");
    setFormSuccess("");
    setIsLoading(true);

    try {
      // Only update keys that have been changed (not masked)
      const updateData: { [key: string]: string } = {};

      if (!sendgridApiKey.includes("•") && sendgridApiKey) {
        updateData.sendgrid_api_key = sendgridApiKey;
      }

      if (!telnyxApiKey.includes("•") && telnyxApiKey) {
        updateData.telnyx_api_key = telnyxApiKey;
      }

      if (Object.keys(updateData).length === 0) {
        setFormError("No changes detected");
        setIsLoading(false);
        return;
      }

      if (apiKeys) {
        // Update existing keys
        const { error } = await supabase
          .from("user_api_keys")
          .update({
            ...updateData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", apiKeys.id);

        if (error) throw error;
      } else {
        // Create new keys
        const { error } = await supabase.from("user_api_keys").insert({
          user_id: userId,
          ...updateData,
        });

        if (error) throw error;
      }

      setFormSuccess("API keys saved successfully");

      // Test the API keys
      await testApiKeys();
    } catch (error: any) {
      console.error("Error saving API keys:", error);
      setFormError(error.message || "An error occurred while saving API keys");
    } finally {
      setIsLoading(false);
    }
  };

  const testApiKeys = async () => {
    try {
      // This would be a call to test the API keys
      // For now, we'll just simulate success
      return true;
    } catch (error) {
      console.error("Error testing API keys:", error);
      return false;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification API Keys</CardTitle>
        <CardDescription>
          Enter your SendGrid and Telnyx API keys to enable email and SMS
          notifications.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {formSuccess && (
          <Alert className="bg-green-50 border-green-200 mb-4">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Success</AlertTitle>
            <AlertDescription className="text-green-700">
              {formSuccess}
            </AlertDescription>
          </Alert>
        )}

        {formError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-2">
          <Label htmlFor="sendgrid-api-key">SendGrid API Key</Label>
          <Input
            id="sendgrid-api-key"
            value={sendgridApiKey}
            onChange={(e) => setSendgridApiKey(e.target.value)}
            placeholder="SG.xxxxxxxxxxxxxxxxxxxxxxxx"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Used for sending email notifications. Get your API key from{" "}
            <a
              href="https://app.sendgrid.com/settings/api_keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              SendGrid
            </a>
            .
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="telnyx-api-key">Telnyx API Key</Label>
          <Input
            id="telnyx-api-key"
            value={telnyxApiKey}
            onChange={(e) => setTelnyxApiKey(e.target.value)}
            placeholder="KEY1234567890ABCDEF"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Used for sending SMS notifications. Get your API key from{" "}
            <a
              href="https://portal.telnyx.com/#/app/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Telnyx
            </a>
            .
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSubmit} disabled={isLoading} className="w-full">
          {isLoading ? "Saving..." : "Save API Keys"}
        </Button>
      </CardFooter>
    </Card>
  );
}
