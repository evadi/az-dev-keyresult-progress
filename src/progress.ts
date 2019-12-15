import Q = require('q');
import Contracts = require('TFS/WorkItemTracking/Contracts');
import { WorkItemFormService } from 'TFS/WorkItemTracking/Services';

import { IStoredFieldReferences } from './stored-field-references';

function GetStoredFields() {
  const deferred = Q.defer();
  VSS.getService<IExtensionDataService>(VSS.ServiceIds.ExtensionData)
    .then((dataService: IExtensionDataService) => {
      dataService.getValue<IStoredFieldReferences>('storedFields')
        .then((storedFields: IStoredFieldReferences) => {
          if (storedFields) {
            deferred.resolve(storedFields);
          } else {
            deferred.reject('Failed to retrieve fields from storage');
          }
        });
    });
  return deferred.promise;
}

function getWorkItemFormService() {
  return WorkItemFormService.getService();
}

function updateProgressOnForm(storedFields: IStoredFieldReferences) {
  getWorkItemFormService()
    .then((service) => {
      service.getFields()
        .then((fields: Contracts.WorkItemField[]) => {
          const matchingCurrentValueValueFields = fields.filter((f: Contracts.WorkItemField) => f.referenceName === storedFields.currentValueField);
          const matchingTargetValueValueFields = fields.filter((f: Contracts.WorkItemField) => f.referenceName === storedFields.targetValueField);
          const matchingProgressValueFields = fields.filter((f: Contracts.WorkItemField) => f.referenceName === storedFields.progressField);
          
          if (matchingCurrentValueValueFields.length > 0 && matchingTargetValueValueFields.length > 0 && 
            matchingProgressValueFields.length > 0) {
            service.getFieldValues([storedFields.currentValueField, storedFields.targetValueField, storedFields.progressField])
              .then((values) => {
                const currentValueFieldValue = values[storedFields.currentValueField];
                const targetValueFieldValue = values[storedFields.targetValueField];

                let currentValue = Number(currentValueFieldValue);
                let targetValue = Number(targetValueFieldValue);

                let progress = calculateProgress(currentValue, targetValue);

                service.setFieldValue(storedFields.progressField, progress);
              });
          }
        });
    });
}

function calculateProgress(current: number, target: number): number {
  let isNaN = (maybeNaN) => maybeNaN!=maybeNaN;

  if (isNaN(current)) {
    current = 0;
  }

  if (isNaN(target)) {
    target = 0;
  }

  //sanity check to ensure no negative result can occur
  if (current > target) {
    current = target;
  }

  try {
    var result = (current*100)/target;

    if (isNaN(result)) {
      return 0;
    }
    else {
      return result;
    }
  }
  catch {
    return 0;
  }
}

const formObserver = () => {
  return {
    onFieldChanged: (args) => {
      GetStoredFields()
        .then((storedFields: IStoredFieldReferences) => {
          if (storedFields && storedFields.currentValueField && storedFields.targetValueField && storedFields.progressField) {
            if (!args.changedFields[storedFields.currentValueField] || !args.changedFields[storedFields.targetValueField] || !args.changedFields[storedFields.progressField]) {
              updateProgressOnForm(storedFields);
            }
          } else {
            console.log('Unable to calculate Progress, please configure fields on the collection settings page.');
          }
        }, (reason) => {
          console.log(reason);
        });
    },

    onLoaded: () => {
      GetStoredFields()
        .then((storedFields: IStoredFieldReferences) => {
          if (storedFields && storedFields.currentValueField && storedFields.targetValueField && storedFields.progressField) {
              updateProgressOnForm(storedFields);
          } else {
            console.log('Unable to calculate Progress, please configure fields on the collection settings page.');
          }
        }, (reason) => {
          console.log(reason);
        });
    }
  };
};

const extensionContext = VSS.getExtensionContext();
VSS.register(`${extensionContext.publisherId}.${extensionContext.extensionId}.keyresult-work-item-form-observer`, formObserver);
