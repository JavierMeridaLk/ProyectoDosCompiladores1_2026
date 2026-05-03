import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BottomPanel } from './bottom-panel';

describe('BottomPanel', () => {
  let component: BottomPanel;
  let fixture: ComponentFixture<BottomPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BottomPanel],
    }).compileComponents();

    fixture = TestBed.createComponent(BottomPanel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
