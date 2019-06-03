import { isEqual } from 'apollo-utilities';
import { ApolloContextValue, SubscriptionResult } from '@apollo/react-common';

import { OperationData } from './OperationData';
import { SubscriptionCurrentObservable, SubscriptionOptions } from '../types';

export class SubscriptionData<
  TData = any,
  TVariables = any
> extends OperationData<SubscriptionOptions<TData, TVariables>> {
  private setResult: any;
  private currentObservable: SubscriptionCurrentObservable = {};

  constructor({
    options,
    context,
    setResult
  }: {
    options: SubscriptionOptions<TData, TVariables>;
    context: ApolloContextValue;
    setResult: any;
  }) {
    super(options, context);
    this.setResult = setResult;
    this.initialize(options);
  }

  public execute(result: SubscriptionResult<TData>) {
    let currentResult = result;

    if (this.refreshClient().isNew) {
      currentResult = this.getLoadingResult();
    }

    let { shouldResubscribe } = this.options;
    if (typeof shouldResubscribe === 'function') {
      shouldResubscribe = !!shouldResubscribe(this.options);
    }

    if (
      shouldResubscribe !== false &&
      this.previousOptions &&
      Object.keys(this.previousOptions).length > 0 &&
      (!isEqual(this.previousOptions.variables, this.options.variables) ||
        this.previousOptions.subscription !== this.options.subscription)
    ) {
      this.endSubscription();
      delete this.currentObservable.query;
      currentResult = this.getLoadingResult();
    }

    this.initialize(this.options);
    this.startSubscription();

    this.previousOptions = this.options;
    return { ...currentResult, variables: this.options.variables };
  }

  public afterExecute() {
    this.isMounted = true;
    return this.unmount.bind(this);
  }

  protected cleanup() {
    this.endSubscription();
    delete this.currentObservable.query;
  }

  private initialize(options: SubscriptionOptions<TData, TVariables>) {
    if (this.currentObservable.query) return;
    this.currentObservable.query = this.refreshClient().client.subscribe({
      query: options.subscription,
      variables: options.variables,
      fetchPolicy: options.fetchPolicy
    });
  }

  private startSubscription() {
    if (this.currentObservable.subscription) return;
    this.currentObservable.subscription = this.currentObservable.query!.subscribe(
      {
        next: this.updateCurrentData.bind(this),
        error: this.updateError.bind(this),
        complete: this.completeSubscription.bind(this)
      }
    );
  }

  private getLoadingResult() {
    return {
      loading: true,
      error: undefined,
      data: undefined
    };
  }

  private updateResult(result: SubscriptionResult) {
    if (this.isMounted) {
      this.setResult(result);
    }
  }

  private updateCurrentData(result: SubscriptionResult<TData>) {
    const {
      options: { onSubscriptionData }
    } = this;

    if (onSubscriptionData) {
      onSubscriptionData({
        client: this.refreshClient().client,
        subscriptionData: result
      });
    }

    this.updateResult({
      data: result.data,
      loading: false,
      error: undefined
    });
  }

  private updateError(error: any) {
    this.updateResult({
      error,
      loading: false
    });
  }

  private completeSubscription() {
    const { onSubscriptionComplete } = this.options;
    if (onSubscriptionComplete) onSubscriptionComplete();
    this.endSubscription();
  }

  private endSubscription() {
    if (this.currentObservable.subscription) {
      this.currentObservable.subscription.unsubscribe();
      delete this.currentObservable.subscription;
    }
  }
}