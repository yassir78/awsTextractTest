import { environment } from './../../environments/environment';
import { Injectable } from '@angular/core';
import { Config, Textract } from 'aws-sdk';
import * as _ from 'lodash';
@Injectable({
  providedIn: 'root',
})
export class TextRactService {
  private textRact: Textract;

  constructor() {
    this.textRact = new Textract();
    this.textRact.config.update({
      accessKeyId: environment.awsConfig.awsAccesskeyID,
      secretAccessKey: environment.awsConfig.awsSecretAccessKey,
      region: environment.awsConfig.awsRegion,
    });
  }
  findValueBlock(keyBlock, valueMap) {
    let valueBlock;
    keyBlock.Relationships.forEach((relationship) => {
      if (relationship.Type === 'VALUE') {
        // eslint-disable-next-line array-callback-return
        relationship.Ids.every((valueId) => {
          if (_.has(valueMap, valueId)) {
            valueBlock = valueMap[valueId];
            return false;
          }
        });
      }
    });
    return valueBlock;
  }
  /////////////////////////////////////////////////////
  getText(result, blocksMap) {
    let text = '';
    if (_.has(result, 'Relationships')) {
      result.Relationships.forEach((relationship) => {
        if (relationship.Type === 'CHILD') {
          relationship.Ids.forEach((childId) => {
            const word = blocksMap[childId];
            if (word.BlockType === 'WORD') {
              text += `${word.Text} `;
            }
            if (word.BlockType === 'SELECTION_ELEMENT') {
              if (word.SelectionStatus === 'SELECTED') {
                text += `X `;
              }
            }
          });
        }
      });
    }
    return text.trim();
  }
  /////////////////////////////////////////////////////
  getKeyValueMap(blocks) {
    {
      const keyMap = {};
      const valueMap = {};
      const blockMap = {};
      let blockId;
      blocks.forEach((block) => {
        blockId = block.Id;
        blockMap[blockId] = block;

        if (block.BlockType === 'KEY_VALUE_SET') {
          if (_.includes(block.EntityTypes, 'KEY')) {
            keyMap[blockId] = block;
          } else {
            valueMap[blockId] = block;
          }
        }
      });
    }
  }
  /////////////////////////////////////////////////////
  getKeyValueRelationship(keyMap, valueMap, blockMap) {
    const keyValues = {};

    const keyMapValues = _.values(keyMap);

    keyMapValues.forEach((keyMapValue) => {
      const valueBlock = this.findValueBlock(keyMapValue, valueMap);
      const key = this.getText(keyMapValue, blockMap);
      const value = this.getText(valueBlock, blockMap);
      keyValues[key] = value;
    });

    return keyValues;
  }
  /////////////////////////////////////////////////////
  async getResult(buffer) {
    const params = {
      Document: {
        /* required */
        Bytes: buffer,
      },
      FeatureTypes: ['FORMS'],
    };

    const request = this.textRact.analyzeDocument(params);
    const data = await request.promise();

    if (data && data.Blocks) {
      const { keyMap, valueMap, blockMap } = this.getKeyValueMap(data.Blocks);
      const keyValues = this.getKeyValueRelationship(
        keyMap,
        valueMap,
        blockMap
      );

      return keyValues;
    }

    // in case no blocks are found return undefined
    return undefined;
  }
}
