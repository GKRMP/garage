/**
 * Garage Filter Integration for Shopify Collection Pages
 *
 * This script automatically applies collection filters based on vehicles
 * saved in the customer's garage.
 *
 * Installation:
 * 1. Add this script to your theme's assets folder
 * 2. Include it on collection pages (collection.liquid or collection-template.liquid)
 * 3. Update the API_BASE_URL to your production backend URL
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    API_BASE_URL: 'https://your-backend.onrender.com', // Update this!
    APPLY_ON_PAGES: ['/collections/all', '/collections'], // Pages where filters should apply
    FILTER_SELECTORS: {
      // Update these selectors to match your Shopify theme's filter elements
      make: 'input[name="filter.p.m.custom.make"]', // Adjust to your theme
      year: 'input[name="filter.p.m.custom.year"]', // Adjust to your theme
      model: 'input[name="filter.p.m.custom.model"]', // Adjust to your theme

      // Alternative: if your theme uses select dropdowns
      makeSelect: 'select[name="make"]',
      yearSelect: 'select[name="year"]',
      modelSelect: 'select[name="model"]',

      // Form to submit after filters are set
      filterForm: 'form[id*="filter"], form.collection-filters, form.facets-form'
    },
    DEBUG: true
  };

  // Utility: Log messages if debug is enabled
  function log(...args) {
    if (CONFIG.DEBUG) {
      console.log('[Garage Filter]', ...args);
    }
  }

  // Check if we're on a collection page
  function shouldApplyFilters() {
    const currentPath = window.location.pathname;
    return CONFIG.APPLY_ON_PAGES.some(page => currentPath.includes(page));
  }

  // Get customer ID from Shopify
  function getCustomerId() {
    // Try to get from Shopify's customer object
    if (window.Shopify && window.Shopify.customer) {
      return `gid://shopify/Customer/${window.Shopify.customer.id}`;
    }

    // Try from meta tag (if you've added one)
    const metaTag = document.querySelector('meta[name="shopify-customer-id"]');
    if (metaTag) {
      return metaTag.content;
    }

    return null;
  }

  // Fetch garage data from backend
  async function fetchGarageFilters(customerId) {
    try {
      log('Fetching garage filters for customer:', customerId);

      const response = await fetch(
        `${CONFIG.API_BASE_URL}/apps/customer/vehicles/filters?customerId=${encodeURIComponent(customerId)}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      log('Garage filter data:', data);

      return data;
    } catch (error) {
      log('Error fetching garage filters:', error);
      return null;
    }
  }

  // Apply filters to the page
  function applyFilters(filterData) {
    if (!filterData || !filterData.defaultFilters) {
      log('No default filters to apply');
      return false;
    }

    const { make, year, model } = filterData.defaultFilters;
    log('Applying filters:', { make, year, model });

    let filtersApplied = false;

    // Try to apply filters using checkboxes/radio buttons
    if (make) {
      filtersApplied = selectFilter(CONFIG.FILTER_SELECTORS.make, make) || filtersApplied;
      filtersApplied = selectDropdown(CONFIG.FILTER_SELECTORS.makeSelect, make) || filtersApplied;
    }

    if (year) {
      filtersApplied = selectFilter(CONFIG.FILTER_SELECTORS.year, year.toString()) || filtersApplied;
      filtersApplied = selectDropdown(CONFIG.FILTER_SELECTORS.yearSelect, year.toString()) || filtersApplied;
    }

    if (model) {
      filtersApplied = selectFilter(CONFIG.FILTER_SELECTORS.model, model) || filtersApplied;
      filtersApplied = selectDropdown(CONFIG.FILTER_SELECTORS.modelSelect, model) || filtersApplied;
    }

    return filtersApplied;
  }

  // Select a filter checkbox/radio button by value
  function selectFilter(selector, value) {
    try {
      const inputs = document.querySelectorAll(selector);

      for (const input of inputs) {
        // Check if the input's value matches (case-insensitive)
        if (input.value.toLowerCase() === value.toLowerCase()) {
          input.checked = true;
          log(`Selected filter: ${selector} = ${value}`);

          // Trigger change event
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
    } catch (error) {
      log('Error selecting filter:', error);
    }

    return false;
  }

  // Select a dropdown option by value
  function selectDropdown(selector, value) {
    try {
      const select = document.querySelector(selector);

      if (!select) {
        return false;
      }

      // Find matching option (case-insensitive)
      const options = Array.from(select.options);
      const matchingOption = options.find(opt =>
        opt.value.toLowerCase() === value.toLowerCase() ||
        opt.text.toLowerCase() === value.toLowerCase()
      );

      if (matchingOption) {
        select.value = matchingOption.value;
        log(`Selected dropdown: ${selector} = ${value}`);

        // Trigger change event
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    } catch (error) {
      log('Error selecting dropdown:', error);
    }

    return false;
  }

  // Submit the filter form if needed
  function submitFilterForm() {
    try {
      const form = document.querySelector(CONFIG.FILTER_SELECTORS.filterForm);

      if (form) {
        log('Submitting filter form');

        // Some themes auto-submit, others need manual submit
        // Try triggering submit event first
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

        // If that doesn't work, actually submit
        setTimeout(() => {
          if (form.tagName === 'FORM') {
            form.submit();
          }
        }, 100);

        return true;
      }
    } catch (error) {
      log('Error submitting form:', error);
    }

    return false;
  }

  // URL-based filter application (for themes that use URL parameters)
  function applyFiltersViaURL(filterData) {
    if (!filterData || !filterData.defaultFilters) {
      return false;
    }

    const { make, year, model } = filterData.defaultFilters;
    const url = new URL(window.location.href);

    // Add filter parameters to URL
    if (make) {
      url.searchParams.set('filter.p.m.custom.make', make);
    }
    if (year) {
      url.searchParams.set('filter.p.m.custom.year', year.toString());
    }
    if (model) {
      url.searchParams.set('filter.p.m.custom.model', model);
    }

    // Only reload if filters were added
    if (url.searchParams.toString() !== window.location.search.substring(1)) {
      log('Applying filters via URL:', url.toString());
      window.location.href = url.toString();
      return true;
    }

    return false;
  }

  // Main initialization
  async function init() {
    log('Garage filter integration initializing...');

    // Check if we should apply filters on this page
    if (!shouldApplyFilters()) {
      log('Not on a collection page, skipping');
      return;
    }

    // Check if filters are already applied (to avoid re-applying on page load)
    if (window.location.search.includes('filter.')) {
      log('Filters already in URL, skipping auto-apply');
      return;
    }

    // Get customer ID
    const customerId = getCustomerId();

    if (!customerId) {
      log('Customer not logged in, skipping');
      return;
    }

    // Fetch garage filter data
    const filterData = await fetchGarageFilters(customerId);

    if (!filterData || filterData.vehicles.length === 0) {
      log('No vehicles in garage, skipping');
      return;
    }

    log(`Customer has ${filterData.vehicles.length} vehicle(s) in garage`);

    // Try to apply filters to existing form elements
    const filtersApplied = applyFilters(filterData);

    // If form-based filtering didn't work, try URL-based
    if (!filtersApplied) {
      log('Form filters not applied, trying URL-based approach');
      applyFiltersViaURL(filterData);
    } else {
      // Filters were applied, optionally submit the form
      // Note: Comment this out if your theme auto-submits on filter change
      // submitFilterForm();
    }
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
