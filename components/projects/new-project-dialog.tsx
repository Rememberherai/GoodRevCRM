'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Building2, Users, Award, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { createProjectSchema, type CreateProjectInput } from '@/lib/validators/project';
import type { ProjectType } from '@/types/project';

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PROJECT_TYPES: { value: ProjectType; title: string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [
  {
    value: 'standard',
    title: 'Standard CRM',
    description: 'Sales pipeline, opportunities, RFPs, sequences, and contracts.',
    icon: Building2,
  },
  {
    value: 'community',
    title: 'Community Center',
    description: 'Households, programs, contributions, contractors, and impact tracking.',
    icon: Users,
  },
  {
    value: 'grants',
    title: 'Grants Management',
    description: 'Grant pipeline, multi-source discovery, documents, reports, and compliance tracking.',
    icon: Award,
  },
];

const FRAMEWORKS = [
  {
    value: 'ccf' as const,
    title: 'Community Capitals Framework',
    description: '7 capitals: Natural, Cultural, Human, Social, Political, Financial, Built.',
  },
  {
    value: 'vital_conditions' as const,
    title: '7 Vital Conditions',
    description: 'Health & well-being framework: Basic Needs, Belonging, Lifelong Learning, and more.',
  },
  {
    value: 'custom' as const,
    title: 'Custom Framework',
    description: 'Define your own impact dimensions later in Settings.',
  },
];

const ACCOUNTING_TARGETS = [
  {
    value: 'goodrev' as const,
    title: 'GoodRev Accounting',
    description: 'Use the built-in accounting module for bills and expenses.',
  },
  {
    value: 'quickbooks' as const,
    title: 'QuickBooks Online',
    description: 'Connect to QuickBooks for bill creation and receipt processing.',
  },
  {
    value: 'none' as const,
    title: 'Skip for Now',
    description: 'Set up accounting integration later in Settings.',
  },
];

export function NewProjectDialog({ open, onOpenChange }: NewProjectDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(0);
  const router = useRouter();

  const form = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      project_type: 'standard',
      framework_type: null,
      accounting_target: null,
    },
  });

  const projectType = form.watch('project_type');
  const isCommunity = projectType === 'community';
  const isGrants = projectType === 'grants';

  // Steps: 0 = type
  // Community: 1 = framework, 2 = accounting, 3 = details
  // Grants: 1 = accounting, 2 = details
  // Standard: 1 = details
  const detailsStep = isCommunity ? 3 : isGrants ? 2 : 1;

  const onSubmit = async (values: CreateProjectInput) => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          slug: values.slug,
          description: values.description || null,
          project_type: values.project_type,
          framework_type: isCommunity ? values.framework_type : undefined,
          accounting_target: (isCommunity || isGrants) ? values.accounting_target : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          form.setError('slug', { message: 'This slug is already taken' });
          return;
        }
        throw new Error(data.error || 'Failed to create project');
      }

      toast.success('Project created successfully');
      handleClose();
      router.push(`/projects/${data.project.slug}`);
      router.refresh();
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create project');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep(0);
    form.reset();
  };

  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    form.setValue('slug', slug);
  };

  const frameworkType = form.watch('framework_type');
  const accountingTarget = form.watch('accounting_target');

  const canAdvance = () => {
    if (step === 0) return true;
    if (step === 1 && isCommunity) return !!frameworkType;
    if (step === 1 && isGrants) return !!accountingTarget;
    if (step === 2 && isCommunity) return !!accountingTarget;
    return true;
  };

  const handleNext = () => {
    if (step === 0 && !isCommunity && !isGrants) {
      // Standard: skip to details
      setStep(detailsStep);
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step === detailsStep && !isCommunity && !isGrants) {
      // Standard: back to type selection
      setStep(0);
    } else {
      setStep(step - 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            {step === 0 && 'Choose the type of project you want to create.'}
            {step === 1 && isCommunity && 'Select an impact measurement framework.'}
            {((step === 2 && isCommunity) || (step === 1 && isGrants)) && 'Choose your accounting integration.'}
            {step === detailsStep && 'Enter your project details.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Step 0: Project Type */}
            {step === 0 && (
              <FormField
                control={form.control}
                name="project_type"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <RadioGroup
                        value={field.value}
                        onValueChange={field.onChange}
                        className="grid gap-3"
                      >
                        {PROJECT_TYPES.map((type) => (
                          <Label
                            key={type.value}
                            htmlFor={`type-${type.value}`}
                            className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                              field.value === type.value
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-muted-foreground/50'
                            }`}
                          >
                            <RadioGroupItem value={type.value} id={`type-${type.value}`} className="mt-0.5" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <type.icon className="h-4 w-4" />
                                <span className="font-medium">{type.title}</span>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{type.description}</p>
                            </div>
                          </Label>
                        ))}
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            {/* Step 1: Framework (community only) */}
            {step === 1 && isCommunity && (
              <FormField
                control={form.control}
                name="framework_type"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <RadioGroup
                        value={field.value ?? ''}
                        onValueChange={field.onChange}
                        className="grid gap-3"
                      >
                        {FRAMEWORKS.map((fw) => (
                          <Label
                            key={fw.value}
                            htmlFor={`fw-${fw.value}`}
                            className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                              field.value === fw.value
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-muted-foreground/50'
                            }`}
                          >
                            <RadioGroupItem value={fw.value} id={`fw-${fw.value}`} className="mt-0.5" />
                            <div className="flex-1">
                              <span className="font-medium">{fw.title}</span>
                              <p className="text-sm text-muted-foreground mt-1">{fw.description}</p>
                            </div>
                          </Label>
                        ))}
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            {/* Accounting Target (community step 2, grants step 1) */}
            {((step === 2 && isCommunity) || (step === 1 && isGrants)) && (
              <FormField
                control={form.control}
                name="accounting_target"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <RadioGroup
                        value={field.value ?? ''}
                        onValueChange={field.onChange}
                        className="grid gap-3"
                      >
                        {ACCOUNTING_TARGETS.map((at) => (
                          <Label
                            key={at.value}
                            htmlFor={`at-${at.value}`}
                            className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                              field.value === at.value
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-muted-foreground/50'
                            }`}
                          >
                            <RadioGroupItem value={at.value} id={`at-${at.value}`} className="mt-0.5" />
                            <div className="flex-1">
                              <span className="font-medium">{at.title}</span>
                              <p className="text-sm text-muted-foreground mt-1">{at.description}</p>
                            </div>
                          </Label>
                        ))}
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            {/* Details Step */}
            {step === detailsStep && (
              <>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={isCommunity ? 'Eastside Community Center' : isGrants ? 'FY2026 Grant Portfolio' : 'My Project'}
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            handleNameChange(e.target.value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slug</FormLabel>
                      <FormControl>
                        <Input placeholder="my-project" {...field} />
                      </FormControl>
                      <FormDescription>
                        URL-friendly identifier for your project
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Optional description..."
                          className="resize-none"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <DialogFooter className="flex gap-2 sm:gap-0">
              {step > 0 ? (
                <Button type="button" variant="outline" onClick={handleBack} disabled={isLoading}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                  Cancel
                </Button>
              )}

              {step < detailsStep ? (
                <Button type="button" onClick={handleNext} disabled={!canAdvance()}>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Project
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
