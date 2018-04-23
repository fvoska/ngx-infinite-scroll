import { debounceTime } from 'rxjs/operators';
import {
  AfterViewInit,
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges
} from '@angular/core';
import { Subscription } from 'rxjs/Subscription';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';

import { InfiniteScrollEvent, IInfiniteScrollAction } from '../models';
import { hasWindowDefined, inputPropChanged } from '../services/ngx-ins-utils';
import { createScroller, InfiniteScrollActions } from '../services/scroll-register';

@Directive({
  selector: '[infiniteScroll], [infinite-scroll], [data-infinite-scroll]'
})
export class InfiniteScrollDirective
  implements OnDestroy, OnChanges, AfterViewInit {
  @Output() scrolled = new EventEmitter<InfiniteScrollEvent>();
  @Output() scrolledUp = new EventEmitter<InfiniteScrollEvent>();

  @Input() infiniteScrollDistance: number = 2;
  @Input() infiniteScrollUpDistance: number = 1.5;
  @Input() infiniteScrollThrottle: number = 150;
  @Input() infiniteScrollDisabled: boolean = false;
  @Input() infiniteScrollContainer: any = null;
  @Input() scrollWindow: boolean = true;
  @Input() immediateCheck: boolean = false;
  @Input() horizontal: boolean = false;
  @Input() alwaysCallback: boolean = false;
  @Input() fromRoot: boolean = false;
  @Input() loadUntilScrollable: Observable<boolean>;

  private disposeScroller: Subscription;

  constructor(private element: ElementRef, private zone: NgZone) { }

  ngAfterViewInit() {
    if (!this.infiniteScrollDisabled) {
      this.setup();
    }
  }

  ngOnChanges({ infiniteScrollContainer, infiniteScrollDisabled, infiniteScrollDistance }: SimpleChanges) {
    const containerChanged = inputPropChanged(infiniteScrollContainer);
    const disabledChanged = inputPropChanged(infiniteScrollDisabled);
    const distanceChanged = inputPropChanged(infiniteScrollDistance);
    const shouldSetup = (!disabledChanged && !this.infiniteScrollDisabled) ||
      (disabledChanged && !infiniteScrollDisabled.currentValue) || distanceChanged;

    if (containerChanged || disabledChanged || distanceChanged) {
      this.destroyScroller();
      if (shouldSetup) {
        this.setup();
      }
    }
  }

  setup() {
    if (hasWindowDefined()) {
      this.zone.runOutsideAngular(() => {
        this.disposeScroller = createScroller({
          fromRoot: this.fromRoot,
          alwaysCallback: this.alwaysCallback,
          disable: this.infiniteScrollDisabled,
          downDistance: this.infiniteScrollDistance,
          element: this.element,
          horizontal: this.horizontal,
          scrollContainer: this.infiniteScrollContainer,
          scrollWindow: this.scrollWindow,
          throttle: this.infiniteScrollThrottle,
          upDistance: this.infiniteScrollUpDistance,
        }).subscribe((payload: any) => this.zone.run(() => this.handleOnScroll(payload)));
      });

      if (this.loadUntilScrollable instanceof Subject) {
        // This piece is in charge of calling handleOnScroll until the items container has scrollbar
        // or until all items are loaded (in case total number of items is not enough to start scrolling
        // or if the container is not scrollable).

        this.loadUntilScrollable.pipe(
          debounceTime(this.infiniteScrollThrottle)
        ).subscribe((allItemsLoaded: boolean) => {
          // Client app should call loadUntilScrollable.next after the subset of items is rendered
          // in order to check if more items have to be loaded in order to make container scrollable.

          if (allItemsLoaded || this.element.nativeElement.scrollHeight > this.element.nativeElement.clientHeight) {
            // Return if all items are loaded or if the container is (or became) scrollable.
            return;
          }

          // Load more items to make container scrollable.
          this.handleOnScroll({
            type: InfiniteScrollActions.DOWN,
            payload: null,
          });
        });
      }
    }
  }

  handleOnScroll({ type, payload }: IInfiniteScrollAction) {
    switch (type) {
      case InfiniteScrollActions.DOWN:
        return this.scrolled.emit(payload);

      case InfiniteScrollActions.UP:
        return this.scrolledUp.emit(payload);

      default:
        return;
    }
  }

  ngOnDestroy() {
    this.destroyScroller();
  }

  destroyScroller() {
    if (this.disposeScroller) {
      this.disposeScroller.unsubscribe();
    }
  }
}
