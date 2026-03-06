import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Eye, EyeOff, LogOut, Camera, Save, User } from "lucide-react";
import type { Session } from "@supabase/supabase-js";

const Parametres = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", userId)
      .single();
    if (data) {
      setDisplayName(data.display_name || "");
      setAvatarUrl(data.avatar_url || "");
    }
  };

  const handleSaveProfile = async () => {
    if (!session) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName, updated_at: new Date().toISOString() })
        .eq("id", session.user.id);
      if (error) throw error;
      toast({ title: "Profil mis à jour" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: "Erreur", description: "Le mot de passe doit contenir au moins 6 caractères.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      toast({ title: "Mot de passe modifié avec succès" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${session.user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("profil-media")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("profil-media")
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq("id", session.user.id);
      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      toast({ title: "Photo de profil mise à jour" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]">Chargement...</div>;
  if (!session) return null;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground">Paramètres</h1>

      {/* Photo de profil */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" /> Photo de profil
          </CardTitle>
          <CardDescription>Changez votre photo de profil</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-center gap-4">
          <Avatar className="h-24 w-24">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="text-2xl bg-primary/10 text-primary">
              {displayName?.charAt(0)?.toUpperCase() || session.user.email?.charAt(0)?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <Label htmlFor="avatar-upload" className="cursor-pointer">
              <div className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium">
                <Camera className="h-4 w-4" />
                {uploadingAvatar ? "Envoi en cours..." : "Changer la photo"}
              </div>
            </Label>
            <Input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
              disabled={uploadingAvatar}
            />
          </div>
        </CardContent>
      </Card>

      {/* Informations du compte */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informations du compte</CardTitle>
          <CardDescription>Gérez vos informations personnelles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={session.user.email || ""} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="display-name">Nom d'affichage</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Votre nom"
            />
          </div>
          <Button onClick={handleSaveProfile} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </CardContent>
      </Card>

      {/* Mot de passe */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Modifier le mot de passe</CardTitle>
          <CardDescription>Choisissez un nouveau mot de passe sécurisé</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nouveau mot de passe</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <Button onClick={handleChangePassword} disabled={saving || !newPassword}>
            {saving ? "Modification..." : "Modifier le mot de passe"}
          </Button>
        </CardContent>
      </Card>

      {/* Déconnexion */}
      <Card>
        <CardContent className="pt-6">
          <Button variant="destructive" onClick={handleLogout} className="w-full sm:w-auto">
            <LogOut className="mr-2 h-4 w-4" /> Se déconnecter
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Parametres;
