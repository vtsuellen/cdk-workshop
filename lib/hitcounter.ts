import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface HitCounterProps {
  /** a função para a qual queremos contar os acessos de URL **/
  downstream: lambda.IFunction;

  readCapacity?: number;
}

export class HitCounter extends Construct {
  public readonly handler: lambda.Function;

  /** a tabela do contador de visitas */
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: HitCounterProps) {
    if (props.readCapacity !== undefined && (props.readCapacity < 5 || props.readCapacity > 20)) {
      throw new Error('readCapacity must be greater than 5 and less than 20');
    }
    super(scope, id);

    const table = new dynamodb.Table(this, 'Hits', {
        partitionKey: { name: 'path', type: dynamodb.AttributeType.STRING },
        encryption: dynamodb.TableEncryption.AWS_MANAGED,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        readCapacity: props.readCapacity ?? 5
    });
    this.table = table;

    this.handler = new lambda.Function(this, 'HitCounterHandler', {
        runtime: lambda.Runtime.NODEJS_16_X,
        handler: 'hitcounter.handler',
        code: lambda.Code.fromAsset('lambda'),
        environment: {
            DOWNSTREAM_FUNCTION_NAME: props.downstream.functionName,
            HITS_TABLE_NAME: table.tableName
        }
    });

    // concede permissões de leitura/gravação à função lambda para nossa tabela
    table.grantReadWriteData(this.handler);

    // concede à função lambda permissões de invocação para a função downstream
    props.downstream.grantInvoke(this.handler);
  }
}