import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/api/api_provider.dart';
import '../../shared/models/shop.dart';

class VendorShopSetupScreen extends ConsumerStatefulWidget {
  const VendorShopSetupScreen({super.key, required this.onCreated});

  final ValueChanged<Shop> onCreated;

  @override
  ConsumerState<VendorShopSetupScreen> createState() => _VendorShopSetupScreenState();
}

class _VendorShopSetupScreenState extends ConsumerState<VendorShopSetupScreen> {
  static const List<String> _topCategories = [
    'Fashion',
    'Kurtas',
    'Sarees',
    'Footwear',
  ];

  static const List<String> _moreCategories = [
    'Kurtis',
    'Jeans',
    'T-Shirts',
    'Dresses',
    'Jackets',
    'Kids',
    'Accessories',
    'Ethnic Wear',
    'Western Wear',
    'Activewear',
    'Nightwear',
  ];

  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _phoneController = TextEditingController();
  final _deliveryTimeController = TextEditingController(text: '25');

  String _selectedCategory = _topCategories.first;
  bool _descriptionTouched = false;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _nameController.addListener(_syncAutoDescription);
    _descriptionController.addListener(_watchDescriptionEdit);
    _syncAutoDescription();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    _phoneController.dispose();
    _deliveryTimeController.dispose();
    super.dispose();
  }

  void _watchDescriptionEdit() {
    final generated = _buildDescription();
    if (_descriptionController.text != generated) {
      _descriptionTouched = true;
    }
  }

  String _buildDescription() {
    final rawName = _nameController.text.trim();
    final safeName = rawName.isEmpty ? 'Your store' : rawName;
    return '$safeName offers $_selectedCategory styles with trusted local delivery and easy everyday shopping.';
  }

  void _syncAutoDescription() {
    if (_descriptionTouched) return;
    final next = _buildDescription();
    _descriptionController.value = TextEditingValue(
      text: next,
      selection: TextSelection.collapsed(offset: next.length),
    );
  }

  Future<void> _pickMoreCategory() async {
    final selected = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            for (final category in _moreCategories)
              ListTile(
                title: Text(category),
                trailing: category == _selectedCategory ? const Icon(Icons.check_circle) : null,
                onTap: () => Navigator.of(context).pop(category),
              ),
          ],
        ),
      ),
    );
    if (selected == null) return;
    setState(() => _selectedCategory = selected);
    _syncAutoDescription();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final shop = await ref.read(apiClientProvider).createShop(
            name: _nameController.text.trim(),
            category: _selectedCategory,
            description: _descriptionController.text.trim(),
            phone: _phoneController.text.trim(),
            deliveryTime: int.tryParse(_deliveryTimeController.text.trim()) ?? 25,
          );
      if (!mounted) return;
      widget.onCreated(shop);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not save store: $error')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: const Color(0xFFF4F8FF),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: Form(
                key: _formKey,
                child: Card(
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(28),
                    side: BorderSide(color: theme.colorScheme.outlineVariant),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(22),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 64,
                          height: 64,
                          decoration: BoxDecoration(
                            color: const Color(0xFFF0E9FF),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: const Color(0xFFD6C7FF)),
                          ),
                          child: const Icon(Icons.storefront_outlined, size: 32, color: Color(0xFF7C5CFF)),
                        ),
                        const SizedBox(height: 24),
                        Text(
                          'Set up your store',
                          style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w900),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Step 1 of 2 - Basic Info',
                          style: theme.textTheme.titleMedium?.copyWith(color: Colors.grey.shade600),
                        ),
                        const SizedBox(height: 22),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(999),
                          child: LinearProgressIndicator(
                            value: 0.5,
                            minHeight: 6,
                            backgroundColor: const Color(0xFFDCEBFF),
                          ),
                        ),
                        const SizedBox(height: 26),
                        _SectionLabel('Shop name *'),
                        const SizedBox(height: 8),
                        TextFormField(
                          controller: _nameController,
                          textInputAction: TextInputAction.next,
                          decoration: const InputDecoration(hintText: 'e.g. Fashion Hub'),
                          validator: (value) => (value == null || value.trim().isEmpty) ? 'Enter shop name' : null,
                        ),
                        const SizedBox(height: 22),
                        _SectionLabel('Category *'),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            for (final category in _topCategories)
                              _CategoryChip(
                                label: category,
                                selected: _selectedCategory == category,
                                onTap: () {
                                  setState(() => _selectedCategory = category);
                                  _syncAutoDescription();
                                },
                              ),
                            _CategoryChip(
                              label: 'More',
                              selected: _moreCategories.contains(_selectedCategory),
                              onTap: _pickMoreCategory,
                              icon: Icons.expand_more,
                            ),
                          ],
                        ),
                        if (_moreCategories.contains(_selectedCategory)) ...[
                          const SizedBox(height: 10),
                          Text(
                            'Selected: $_selectedCategory',
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: theme.colorScheme.primary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                        const SizedBox(height: 22),
                        Row(
                          children: [
                            const Expanded(child: _SectionLabel('Description')),
                            TextButton(
                              onPressed: () {
                                setState(() => _descriptionTouched = false);
                                _syncAutoDescription();
                              },
                              child: const Text('Auto fill'),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        TextFormField(
                          controller: _descriptionController,
                          minLines: 3,
                          maxLines: 4,
                          decoration: const InputDecoration(hintText: 'Store description'),
                        ),
                        const SizedBox(height: 22),
                        _SectionLabel('Phone'),
                        const SizedBox(height: 8),
                        TextFormField(
                          controller: _phoneController,
                          keyboardType: TextInputType.phone,
                          textInputAction: TextInputAction.next,
                          decoration: const InputDecoration(hintText: 'Shop number'),
                        ),
                        const SizedBox(height: 22),
                        _SectionLabel('Delivery time (min)'),
                        const SizedBox(height: 8),
                        TextFormField(
                          controller: _deliveryTimeController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(),
                          validator: (value) {
                            final minutes = int.tryParse('${value ?? ''}'.trim());
                            if (minutes == null || minutes < 5) return 'Enter valid minutes';
                            return null;
                          },
                        ),
                        const SizedBox(height: 28),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton(
                            onPressed: _saving ? null : _submit,
                            child: Text(_saving ? 'Saving...' : 'Next: Set Location'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: Theme.of(context).textTheme.labelLarge?.copyWith(
        fontWeight: FontWeight.w800,
        letterSpacing: 1,
        color: const Color(0xFF66778B),
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
    required this.label,
    required this.selected,
    required this.onTap,
    this.icon,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFEAF4FF) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: selected ? theme.colorScheme.primary : const Color(0xFFD8E8F8),
            width: selected ? 2 : 1.4,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w800,
                color: selected ? theme.colorScheme.primary : const Color(0xFF22354A),
              ),
            ),
            if (icon != null) ...[
              const SizedBox(width: 6),
              Icon(icon, size: 18, color: selected ? theme.colorScheme.primary : const Color(0xFF6C8096)),
            ],
          ],
        ),
      ),
    );
  }
}
