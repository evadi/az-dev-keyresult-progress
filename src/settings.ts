import './settings.scss';

import Q = require('q');
import Contracts = require('TFS/WorkItemTracking/Contracts');
import WIT_Client = require('TFS/WorkItemTracking/RestClient');
import Controls = require('VSS/Controls');
import { Combo, IComboOptions } from 'VSS/Controls/Combos';
import Menus = require('VSS/Controls/Menus');

import { IStoredFieldReferences } from './stored-field-references';

export class Settings {
  selectedFields: IStoredFieldReferences;
  fields: Contracts.WorkItemField[];
  menuBar = null;
  changeMade = false;

  public initialize() {
    const menubarOptions = {
      items: [
        { id: 'save', icon: 'icon-save', title: 'Save the selected field' }
      ],
      executeAction: (args) => {
        const command = args.get_commandName();
        switch (command) {
          case 'save':
            this.save();
            break;
          default:
            console.log('Unhandled action: ' + command);
            break;
        }
      }
    };
    const mainContainer = $('#progress-settings');
    this.menuBar = Controls.create<Menus.MenuBar, any>(Menus.MenuBar, mainContainer, menubarOptions);

    //Ansoff Fields
    const currentValueContainer = $('<div />').addClass('settings-control').appendTo(mainContainer);
    $('<label />').text('Current Value Field').appendTo(currentValueContainer);

    const targetValueContainer = $('<div />').addClass('settings-control').appendTo(mainContainer);
    $('<label />').text('Target Value Field').appendTo(targetValueContainer);

    const progressContainer = $('<div />').addClass('settings-control').appendTo(mainContainer);
    $('<label />').text('Progress Field').appendTo(progressContainer);


    VSS.getService<IExtensionDataService>(VSS.ServiceIds.ExtensionData)
      .then((dataService: IExtensionDataService) => {
        dataService.getValue<IStoredFieldReferences>('storedFields')
          .then((storedFields: IStoredFieldReferences) => {
            if (storedFields) {
              this.selectedFields = storedFields;
            } else {
              this.selectedFields = {
                currentValueField: null,
                targetValueField: null,
                progressField: null
              };
            }

            this.getSortedFieldsList().then((fieldList) => {
              Controls.create(Combo, currentValueContainer, this.getComboOptions('currentValueFieldValue', fieldList, this.selectedFields.currentValueField));
              Controls.create(Combo, targetValueContainer, this.getComboOptions('targetValueFieldValue', fieldList, this.selectedFields.targetValueField));
              Controls.create(Combo, progressContainer, this.getComboOptions('progressFieldValue', fieldList, this.selectedFields.progressField));
              
              this.updateSaveButton();

              VSS.notifyLoadSucceeded();
            });
          });
      });
  }

  private getSortedFieldsList() {
    const deferred = Q.defer();
    WIT_Client.getClient()
      .getFields()
      .then((fields: Contracts.WorkItemField[]) => {
        this.fields = fields;
        const sortedFields = this.fields.map((f: Contracts.WorkItemField) => f.name).sort((field1, field2) => {
          if (field1 > field2)
            return 1;
          else if (field1 < field2)
            return -1;
          else
            return 0;
        });
        deferred.resolve(sortedFields);
      });

    return deferred.promise;
  }

  private getComboOptions(id, fieldsList, initialField): IComboOptions {
    const that = this;
    return {
      id,
      mode: 'drop',
      source: fieldsList,
      enabled: true,
      value: that.getFieldName(initialField),
      change() {
        that.changeMade = true;
        const fieldName = this.getText();
        const fieldReferenceName: string = (this.getSelectedIndex() < 0) ? null : that.getFieldReferenceName(fieldName);

        switch (this._id) {
          case 'currentValueFieldValue':
            that.selectedFields.currentValueField = fieldReferenceName;
            break;
          case 'targetValueFieldValue':
            that.selectedFields.targetValueField = fieldReferenceName;
            break;
          case 'progressFieldValue':
            that.selectedFields.progressField = fieldReferenceName;
            break;
        }
        that.updateSaveButton();
      }
    };
  }

  private save() {
    VSS.getService<IExtensionDataService>(VSS.ServiceIds.ExtensionData)
      .then((dataService: IExtensionDataService) => {
        dataService.setValue<IStoredFieldReferences>('storedFields', this.selectedFields)
          .then((storedFields: IStoredFieldReferences) => {
            this.changeMade = false;
            this.updateSaveButton();
          });
      });
  }

  private getFieldName(fieldReferenceName): string {
    let matchingFields = this.fields.filter((f: Contracts.WorkItemField) => f.referenceName === fieldReferenceName);
    return (matchingFields.length > 0) ? matchingFields[0].name : null;
  }

  private getFieldReferenceName(fieldName): string {
    let matchingFields = this.fields.filter((f: Contracts.WorkItemField) => f.name === fieldName);
    return (matchingFields.length > 0) ? matchingFields[0].referenceName : null;
  }

  private updateSaveButton() {
    const buttonState = (this.selectedFields.currentValueField && 
      this.selectedFields.targetValueField && this.selectedFields.progressField) && this.changeMade
      ? Menus.MenuItemState.None : Menus.MenuItemState.Disabled;

    // Update the disabled state
    this.menuBar.updateCommandStates([
      { id: 'save', disabled: buttonState },
    ]);
  }
}
